import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeBackoffDelayMs,
  FREE_VIDEO_MODEL_CHAIN,
  parseGeminiApiError,
  parseRetryDelaySeconds,
  sanitizeErrorText,
  shouldTryFreeFallbackModel,
} from './geminiErrorParser.ts';

test('sanitizeErrorText redacts API keys, Bearer tokens, and query tokens', () => {
  const dirty =
    'Request failed for https://example.com?key=AIzaSyDummyKeyValue1234567890ABCD and Bearer secret.jwt.token';
  const clean = sanitizeErrorText(dirty);
  assert.ok(!clean.includes('AIzaSyDummyKeyValue1234567890ABCD'));
  assert.ok(!clean.includes('secret.jwt.token'));
  assert.ok(clean.includes('[REDACTED'));
});

test('parseRetryDelaySeconds parses RetryInfo duration strings and numbers', () => {
  assert.equal(parseRetryDelaySeconds('42s'), 42);
  assert.equal(parseRetryDelaySeconds('12.2s'), 13);
  assert.equal(parseRetryDelaySeconds(7.1), 8);
  assert.equal(parseRetryDelaySeconds('invalid'), undefined);
});

test('parseGeminiApiError classifies prepayment credits depleted as non-retryable spending-cap', () => {
  const err = {
    status: 429,
    message: JSON.stringify({
      error: {
        code: 429,
        message:
          'Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing.',
        status: 'RESOURCE_EXHAUSTED',
      },
    }),
  };

  const parsed = parseGeminiApiError(err, { model: 'gemini-4-hydrogen' });
  assert.equal(parsed.httpStatus, 429);
  assert.equal(parsed.upstreamStatus, 'RESOURCE_EXHAUSTED');
  assert.equal(parsed.kind, 'spending-cap');
  assert.equal(parsed.code, 'PREPAYMENT_CREDITS_DEPLETED');
  assert.equal(parsed.retryable, false);
  assert.equal(parsed.model, 'gemini-4-hydrogen');
  assert.match(parsed.userMessage, /prepayment credits are depleted/i);
  assert.match(parsed.actionHint, /SHA-256 fingerprint remain saved/i);
});

test('parseGeminiApiError classifies daily RPD quota failure as non-retryable daily-quota', () => {
  const err = {
    status: 429,
    message: JSON.stringify({
      error: {
        code: 429,
        message: 'Quota exceeded for quota metric GenerateContentRequests PerDay.',
        status: 'RESOURCE_EXHAUSTED',
        details: [
          {
            '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
            violations: [
              {
                quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests',
                quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier',
                quotaDimensions: { model: 'gemini-4-hydrogen', location: 'global' },
                quotaValue: '50',
              },
            ],
          },
          {
            '@type': 'type.googleapis.com/google.rpc.RetryInfo',
            retryDelay: '3600s',
          },
        ],
      },
    }),
  };

  const parsed = parseGeminiApiError(err, { model: 'gemini-4-hydrogen' });
  assert.equal(parsed.kind, 'daily-quota');
  assert.equal(parsed.code, 'DAILY_QUOTA_EXHAUSTED');
  assert.equal(parsed.retryable, false);
  assert.equal(parsed.retryAfterSeconds, 3600);
  assert.equal(parsed.quotaId, 'GenerateRequestsPerDayPerProjectPerModel-FreeTier');
  assert.equal(parsed.model, 'gemini-4-hydrogen');
});

test('parseGeminiApiError classifies PerMinute RPM limit with RetryInfo as retryable rate-limit', () => {
  const err = {
    status: 429,
    message: JSON.stringify({
      error: {
        code: 429,
        message: 'Rate limit exceeded. Please retry in 3.2s.',
        status: 'RESOURCE_EXHAUSTED',
        details: [
          {
            '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
            violations: [
              {
                quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests',
                quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier',
                quotaDimensions: { model: 'gemini-4-hydrogen' },
              },
            ],
          },
          {
            '@type': 'type.googleapis.com/google.rpc.RetryInfo',
            retryDelay: '3.2s',
          },
        ],
      },
    }),
  };

  const parsed = parseGeminiApiError(err);
  assert.equal(parsed.kind, 'rate-limit');
  assert.equal(parsed.code, 'RATE_LIMIT_EXCEEDED');
  assert.equal(parsed.retryable, true);
  assert.equal(parsed.retryAfterSeconds, 4);
  assert.match(parsed.userMessage, /wait ~4s/i);
});

test('FREE_VIDEO_MODEL_CHAIN excludes paid-only models and avoids masking primary model on prepayment depletion', () => {
  assert.deepEqual([...FREE_VIDEO_MODEL_CHAIN], ['gemini-3.5-flash-lite', 'gemini-4-hydrogen']);
  assert.equal(
    shouldTryFreeFallbackModel(
      parseGeminiApiError({ status: 404, message: 'Model not found' }, { model: 'gemini-3.5-flash-lite' })
    ),
    true
  );
  assert.equal(
    shouldTryFreeFallbackModel(
      parseGeminiApiError({ status: 403, message: 'PERMISSION_DENIED' }, { model: 'gemini-3.5-flash-lite' })
    ),
    false
  );

  const depleted = parseGeminiApiError(
    {
      status: 429,
      message: JSON.stringify({
        error: {
          code: 429,
          status: 'RESOURCE_EXHAUSTED',
          message: 'Your prepayment credits are depleted.',
        },
      }),
    },
    { model: 'gemini-3.5-flash-lite', attemptedModels: ['gemini-3.5-flash-lite'] }
  );
  assert.equal(shouldTryFreeFallbackModel(depleted), false);
  assert.match(depleted.userMessage, /tested gemini-3\.5-flash-lite/);
});

test('computeBackoffDelayMs bounds exponential backoff and skips waits exceeding maxWaitMs', () => {
  assert.equal(computeBackoffDelayMs(1, undefined, 4500), 800);
  assert.equal(computeBackoffDelayMs(2, undefined, 4500), 1600);
  assert.equal(computeBackoffDelayMs(3, undefined, 4500), 3200);
  assert.equal(computeBackoffDelayMs(1, 3, 4500), 3000);
  assert.equal(computeBackoffDelayMs(1, 30, 4500), null);
});
