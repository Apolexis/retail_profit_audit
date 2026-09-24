/**
 * Converts an external/runtime error into a concise user-facing Russian
 * diagnostic. Technical library messages, request fragments and credentials
 * are never allowed to escape into scheduled or inbound HTTP responses.
 */
export function safeRussianDiagnostic(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message.trim() : "";
  return /^[А-Яа-яЁё0-9\s.,:;!?«»()—–-]+$/.test(message) ? message.slice(0, 512) : fallback;
}

/** Missing scheduler credentials are an access denial, not an execution fault. */
export function isSchedulerAuthenticationFailure(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return /missing session cookie|invalid session cookie|missing authorization|not authenticated|unauthorized|cron session missing/.test(message);
}
