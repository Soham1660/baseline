export interface ApiErrorPayload {
  error?: string;
  code?: string;
  quotaKind?: string;
  retryable?: boolean;
  retryAfterSeconds?: number;
  model?: string;
  attemptedModels?: string[];
  quotaMetric?: string;
  quotaId?: string;
  actionHint?: string;
  upstreamStatus?: string;
}

export interface FormattedUiError {
  message: string;
  actionHint?: string;
  code?: string;
  quotaKind?: string;
  retryAfterSeconds?: number;
  attemptedModels?: string[];
  isQuotaOrModelBlocked: boolean;
}

export function parseApiErrorResponse(
  payload: ApiErrorPayload | null | undefined,
  fallbackMessage: string
): FormattedUiError {
  const message =
    typeof payload?.error === 'string' && payload.error.trim()
      ? payload.error.trim()
      : fallbackMessage;

  const isQuotaOrModelBlocked =
    payload?.quotaKind === 'spending-cap' ||
    payload?.quotaKind === 'daily-quota' ||
    payload?.quotaKind === 'rate-limit' ||
    payload?.quotaKind === 'quota-unknown' ||
    payload?.quotaKind === 'auth-error' ||
    payload?.quotaKind === 'model-not-found' ||
    payload?.code === 'PREPAYMENT_CREDITS_DEPLETED' ||
    payload?.code === 'RESOURCE_EXHAUSTED';

  return {
    message,
    actionHint: typeof payload?.actionHint === 'string' ? payload.actionHint : undefined,
    code: typeof payload?.code === 'string' ? payload.code : undefined,
    quotaKind: typeof payload?.quotaKind === 'string' ? payload.quotaKind : undefined,
    retryAfterSeconds:
      typeof payload?.retryAfterSeconds === 'number' && Number.isFinite(payload.retryAfterSeconds)
        ? Math.max(1, Math.ceil(payload.retryAfterSeconds))
        : undefined,
    attemptedModels: Array.isArray(payload?.attemptedModels) ? payload.attemptedModels : undefined,
    isQuotaOrModelBlocked,
  };
}

export function formatUiErrorBannerText(err: FormattedUiError): string {
  const parts = [err.message];
  if (err.actionHint && !err.message.includes(err.actionHint)) {
    parts.push(err.actionHint);
  }
  return parts.join(' ');
}
