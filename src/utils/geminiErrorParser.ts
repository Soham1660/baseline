export type QuotaFailureKind =
  | 'spending-cap'
  | 'daily-quota'
  | 'rate-limit'
  | 'model-restricted'
  | 'quota-unknown'
  | 'model-not-found'
  | 'auth-error'
  | 'transient'
  | 'unknown';

export interface ParsedGeminiError {
  httpStatus: number;
  upstreamStatus?: string;
  code: string;
  kind: QuotaFailureKind;
  retryable: boolean;
  retryAfterSeconds?: number;
  model?: string;
  quotaMetric?: string;
  quotaId?: string;
  quotaValue?: string;
  quotaDimensions?: Record<string, string>;
  errorReason?: string;
  errorMetadata?: Record<string, string>;
  upstreamMessage: string;
  userMessage: string;
  actionHint: string;
}

export const PRIMARY_FREE_VIDEO_MODEL = 'gemini-3.5-flash-lite';
export const FALLBACK_FREE_VIDEO_MODEL = 'gemini-4-hydrogen';
export const FREE_VIDEO_MODEL_CHAIN = [
  PRIMARY_FREE_VIDEO_MODEL,
  FALLBACK_FREE_VIDEO_MODEL,
] as const;

/**
 * Redacts any API-key-like or Bearer secret substrings before logging or returning messages.
 */
export function sanitizeErrorText(input: string): string {
  return input
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, '[REDACTED_KEY]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/([?&](?:key|api_key|token)=)[^&\s"']+/gi, '$1[REDACTED]');
}

export function parseRetryDelaySeconds(val: unknown): number | undefined {
  if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
    return Math.ceil(val);
  }
  if (typeof val === 'string') {
    const match = val.trim().match(/^(\d+(?:\.\d+)?)s$/i);
    if (match) {
      const n = Number(match[1]);
      if (Number.isFinite(n) && n > 0) return Math.ceil(n);
    }
  }
  return undefined;
}

function extractRetryFromMessage(msg: string): number | undefined {
  const m = msg.match(/retry\s+(?:in|after)\s+(\d+(?:\.\d+)?)\s*s(?:ec(?:ond)?s?)?/i);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0) return Math.ceil(n);
  }
  return undefined;
}

function extractJsonObjectFromMessage(msg: string): Record<string, unknown> | null {
  const trimmed = msg.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function shouldTryFreeFallbackModel(parsed: ParsedGeminiError): boolean {
  if (parsed.kind === 'auth-error') return false;
  if (
    parsed.code === 'MISSING_API_KEY' ||
    parsed.code === 'API_KEY_INVALID' ||
    parsed.code === 'PREPAYMENT_CREDITS_DEPLETED'
  ) {
    return false;
  }
  return (
    parsed.kind === 'model-not-found' ||
    parsed.kind === 'model-restricted' ||
    parsed.kind === 'spending-cap' ||
    parsed.kind === 'daily-quota' ||
    parsed.kind === 'rate-limit' ||
    parsed.kind === 'quota-unknown' ||
    parsed.kind === 'transient'
  );
}

export function computeBackoffDelayMs(
  attempt: number,
  retryAfterSeconds?: number,
  maxWaitMs = 4500
): number | null {
  if (retryAfterSeconds !== undefined) {
    const requestedMs = retryAfterSeconds * 1000;
    if (requestedMs > maxWaitMs) return null;
    return requestedMs;
  }
  const exp = Math.min(maxWaitMs, 800 * Math.pow(2, Math.max(0, attempt - 1)));
  return exp;
}

export function parseGeminiApiError(
  err: unknown,
  context?: { model?: string; attemptedModels?: string[]; retryAfterHeader?: string | null }
): ParsedGeminiError {
  const anyErr = err as {
    statusCode?: number;
    status?: number;
    code?: string;
    message?: string;
  };

  const rawStatus = anyErr?.statusCode || anyErr?.status || 500;
  const httpStatus = rawStatus >= 400 && rawStatus < 600 ? rawStatus : 500;
  const rawMessage = sanitizeErrorText(
    typeof anyErr?.message === 'string' && anyErr.message
      ? anyErr.message
      : 'An unexpected error occurred while contacting Gemini.'
  );

  if (anyErr?.code === 'MISSING_API_KEY') {
    return {
      httpStatus: 503,
      code: 'MISSING_API_KEY',
      kind: 'auth-error',
      retryable: false,
      model: context?.model,
      upstreamMessage: rawMessage,
      userMessage: rawMessage,
      actionHint: 'Configure GEMINI_API_KEY on the server (Settings > Secrets), or open the Sample Demonstration.',
    };
  }

  // Parse structured Google RPC error JSON embedded in ApiError.message
  const parsedBody = extractJsonObjectFromMessage(rawMessage);
  const errorObj =
    parsedBody && typeof parsedBody.error === 'object' && parsedBody.error !== null
      ? (parsedBody.error as Record<string, unknown>)
      : parsedBody;

  const upstreamStatus =
    typeof errorObj?.status === 'string' ? errorObj.status : undefined;
  const upstreamMessage = sanitizeErrorText(
    typeof errorObj?.message === 'string' && errorObj.message.trim()
      ? errorObj.message.trim()
      : rawMessage
  );

  const details = Array.isArray(errorObj?.details) ? errorObj.details : [];
  let quotaMetric: string | undefined;
  let quotaId: string | undefined;
  let quotaValue: string | undefined;
  let quotaDimensions: Record<string, string> | undefined;
  let retryAfterSeconds: number | undefined;
  let errorReason: string | undefined;
  let errorMetadata: Record<string, string> | undefined;

  if (context?.retryAfterHeader) {
    const headerSecs = Number(context.retryAfterHeader);
    if (Number.isFinite(headerSecs) && headerSecs > 0) {
      retryAfterSeconds = Math.ceil(headerSecs);
    }
  }

  for (const detail of details) {
    if (!detail || typeof detail !== 'object') continue;
    const d = detail as Record<string, unknown>;
    const typeStr = typeof d['@type'] === 'string' ? d['@type'] : '';

    if (typeStr.includes('RetryInfo') || 'retryDelay' in d) {
      const parsedDelay = parseRetryDelaySeconds(d.retryDelay);
      if (parsedDelay !== undefined) {
        retryAfterSeconds = parsedDelay;
      }
    }

    if (typeStr.includes('QuotaFailure') && Array.isArray(d.violations)) {
      const v = d.violations[0] as Record<string, unknown> | undefined;
      if (v) {
        if (typeof v.quotaMetric === 'string') quotaMetric = v.quotaMetric;
        if (typeof v.quotaId === 'string') quotaId = v.quotaId;
        if (typeof v.quotaValue === 'string') quotaValue = v.quotaValue;
        else if (typeof v.quotaValue === 'number') quotaValue = String(v.quotaValue);
        if (v.quotaDimensions && typeof v.quotaDimensions === 'object') {
          const dims: Record<string, string> = {};
          for (const [k, val] of Object.entries(v.quotaDimensions as Record<string, unknown>)) {
            if (typeof val === 'string') dims[k] = sanitizeErrorText(val);
          }
          if (Object.keys(dims).length > 0) quotaDimensions = dims;
        }
      }
    }

    if (typeStr.includes('ErrorInfo')) {
      if (typeof d.reason === 'string') errorReason = d.reason;
      if (d.metadata && typeof d.metadata === 'object') {
        const meta: Record<string, string> = {};
        for (const [k, val] of Object.entries(d.metadata as Record<string, unknown>)) {
          if (typeof val === 'string') meta[k] = sanitizeErrorText(val);
        }
        if (Object.keys(meta).length > 0) errorMetadata = meta;
      }
    }
  }

  if (retryAfterSeconds === undefined) {
    retryAfterSeconds = extractRetryFromMessage(upstreamMessage);
  }

  const effectiveModel = quotaDimensions?.model || context?.model;
  const testedModels = Array.from(
    new Set(
      (context?.attemptedModels && context.attemptedModels.length > 0
        ? context.attemptedModels
        : effectiveModel
          ? [effectiveModel]
          : []
      ).filter(Boolean)
    )
  );
  const testedLabel = testedModels.join(', ');
  const combinedSignals = [upstreamMessage, quotaMetric || '', quotaId || '', errorReason || '']
    .join(' ')
    .toLowerCase();

  // Auth / API key errors
  if (
    httpStatus === 400 &&
    (combinedSignals.includes('api_key_invalid') || combinedSignals.includes('api key not valid'))
  ) {
    return {
      httpStatus: 400,
      upstreamStatus: upstreamStatus || 'INVALID_ARGUMENT',
      code: 'API_KEY_INVALID',
      kind: 'auth-error',
      retryable: false,
      model: effectiveModel,
      errorReason,
      errorMetadata,
      upstreamMessage,
      userMessage: 'The configured Gemini API key was rejected as invalid.',
      actionHint: 'Verify GEMINI_API_KEY in Settings > Secrets, or explore the Sample Demonstration.',
    };
  }

  if (httpStatus === 403 || upstreamStatus === 'PERMISSION_DENIED') {
    return {
      httpStatus: 403,
      upstreamStatus: upstreamStatus || 'PERMISSION_DENIED',
      code: 'PERMISSION_DENIED',
      kind: 'auth-error',
      retryable: false,
      model: effectiveModel,
      errorReason,
      errorMetadata,
      upstreamMessage,
      userMessage: `Gemini API permission denied${effectiveModel ? ` for ${effectiveModel}` : ''}.`,
      actionHint: 'Check API key permissions without enabling paid billing, or open the Sample Demonstration.',
    };
  }

  // Model not found / unsupported
  if (httpStatus === 404 || upstreamStatus === 'NOT_FOUND') {
    return {
      httpStatus: 404,
      upstreamStatus: upstreamStatus || 'NOT_FOUND',
      code: 'MODEL_NOT_FOUND',
      kind: 'model-not-found',
      retryable: false,
      model: effectiveModel,
      errorReason,
      errorMetadata,
      upstreamMessage,
      userMessage: `The requested Gemini model${effectiveModel ? ` (${effectiveModel})` : ''} is unavailable or not supported.`,
      actionHint: 'Your video and SHA-256 fingerprint remain preserved. You can explore the Sample Demonstration anytime.',
    };
  }

  // 429 / RESOURCE_EXHAUSTED classification: distinguish depleted credits / $0 spending cap, daily quota, RPM/TPM
  if (
    httpStatus === 429 ||
    upstreamStatus === 'RESOURCE_EXHAUSTED' ||
    combinedSignals.includes('resource_exhausted')
  ) {
    const isPrepaymentDepleted =
      combinedSignals.includes('prepayment credits are depleted') ||
      combinedSignals.includes('credits are depleted');

    const isZeroLimit =
      isPrepaymentDepleted ||
      /\blimit\s*:\s*0\b/i.test(upstreamMessage) ||
      quotaValue === '0' ||
      combinedSignals.includes('spending cap') ||
      combinedSignals.includes('spending_cap');

    const isDaily =
      /per_?day|per-day/i.test(quotaId || '') ||
      /per_?day/i.test(quotaMetric || '') ||
      /requests?\s+per\s+day|daily\s+quota|\brpd\b/i.test(upstreamMessage);

    const isPerMinute =
      /per_?minute|per-minute/i.test(quotaId || '') ||
      /per_?minute/i.test(quotaMetric || '') ||
      /per\s+minute|requests?\s+per\s+minute|tokens?\s+per\s+minute|\brpm\b|\btpm\b/i.test(upstreamMessage);

    if (isPrepaymentDepleted) {
      return {
        httpStatus: 429,
        upstreamStatus: upstreamStatus || 'RESOURCE_EXHAUSTED',
        code: 'PREPAYMENT_CREDITS_DEPLETED',
        kind: 'spending-cap',
        retryable: false,
        retryAfterSeconds,
        model: effectiveModel,
        quotaMetric,
        quotaId,
        quotaValue,
        quotaDimensions,
        errorReason,
        errorMetadata,
        upstreamMessage,
        userMessage: `Live Gemini analysis is unavailable: the attached AI Studio project's prepayment credits are depleted ($0 spending cap; tested ${testedLabel || 'gemini-3.5-flash-lite'}).`,
        actionHint: 'Your uploaded video and SHA-256 fingerprint remain saved—no need to re-upload. Click Retry Analysis once a project with active free-tier quota or credits is connected, or explore the precomputed Sample Demonstration.',
      };
    }

    if (isZeroLimit) {
      return {
        httpStatus: 429,
        upstreamStatus: upstreamStatus || 'RESOURCE_EXHAUSTED',
        code: 'QUOTA_ZERO_OR_SPENDING_CAP',
        kind: 'spending-cap',
        retryable: false,
        retryAfterSeconds,
        model: effectiveModel,
        quotaMetric,
        quotaId,
        quotaValue,
        quotaDimensions,
        errorReason,
        errorMetadata,
        upstreamMessage,
        userMessage: `Gemini API quota limit is 0${effectiveModel ? ` for ${effectiveModel}` : ''} (spending cap or no active free-tier allowance on this project/model).`,
        actionHint: 'Your uploaded video and SHA-256 fingerprint are preserved. Use the Sample Demonstration or retry after project quota is available.',
      };
    }

    if (isDaily) {
      return {
        httpStatus: 429,
        upstreamStatus: upstreamStatus || 'RESOURCE_EXHAUSTED',
        code: 'DAILY_QUOTA_EXHAUSTED',
        kind: 'daily-quota',
        retryable: false,
        retryAfterSeconds,
        model: effectiveModel,
        quotaMetric,
        quotaId,
        quotaValue,
        quotaDimensions,
        errorReason,
        errorMetadata,
        upstreamMessage,
        userMessage: `Daily free-tier Gemini quota exhausted${effectiveModel ? ` for ${effectiveModel}` : ''}.${retryAfterSeconds ? ` Retry in ~${retryAfterSeconds}s or after daily reset.` : ' Try again after the daily quota resets.'}`,
        actionHint: 'Your uploaded video and SHA-256 fingerprint are preserved so you can click Retry Analysis later without re-uploading.',
      };
    }

    if (isPerMinute || retryAfterSeconds !== undefined) {
      const waitMsg = retryAfterSeconds
        ? ` Please wait ~${retryAfterSeconds}s before clicking Retry Analysis.`
        : ' Please wait briefly and click Retry Analysis.';
      return {
        httpStatus: 429,
        upstreamStatus: upstreamStatus || 'RESOURCE_EXHAUSTED',
        code: 'RATE_LIMIT_EXCEEDED',
        kind: 'rate-limit',
        retryable: true,
        retryAfterSeconds,
        model: effectiveModel,
        quotaMetric,
        quotaId,
        quotaValue,
        quotaDimensions,
        errorReason,
        errorMetadata,
        upstreamMessage,
        userMessage: `Temporary Gemini rate limit reached${effectiveModel ? ` (${effectiveModel})` : ''}.${waitMsg}`,
        actionHint: 'Your uploaded video and SHA-256 fingerprint remain preserved—click Retry Analysis after the cooldown.',
      };
    }

    return {
      httpStatus: 429,
      upstreamStatus: upstreamStatus || 'RESOURCE_EXHAUSTED',
      code: 'RESOURCE_EXHAUSTED',
      kind: 'quota-unknown',
      retryable: false,
      retryAfterSeconds,
      model: effectiveModel,
      quotaMetric,
      quotaId,
      quotaValue,
      quotaDimensions,
      errorReason,
      errorMetadata,
      upstreamMessage,
      userMessage: `Gemini API quota exhausted${effectiveModel ? ` (${effectiveModel})` : ''}: ${upstreamMessage}`,
      actionHint: 'Your uploaded video and SHA-256 fingerprint are preserved for Retry Analysis, or you can open the Sample Demonstration.',
    };
  }

  // Transient 5xx errors
  if (httpStatus >= 500) {
    return {
      httpStatus,
      upstreamStatus,
      code: 'GEMINI_TRANSIENT_ERROR',
      kind: 'transient',
      retryable: true,
      retryAfterSeconds,
      model: effectiveModel,
      errorReason,
      errorMetadata,
      upstreamMessage,
      userMessage: `Gemini service temporarily unavailable (HTTP ${httpStatus}). Please click Retry Analysis in a moment.`,
      actionHint: 'Your uploaded video and SHA-256 fingerprint are preserved for Retry Analysis.',
    };
  }

  return {
    httpStatus,
    upstreamStatus,
    code: 'GEMINI_ERROR',
    kind: 'unknown',
    retryable: false,
    retryAfterSeconds,
    model: effectiveModel,
    quotaMetric,
    quotaId,
    quotaValue,
    quotaDimensions,
    errorReason,
    errorMetadata,
    upstreamMessage,
    userMessage: upstreamMessage,
    actionHint: 'Your uploaded video and SHA-256 fingerprint remain preserved.',
  };
}
