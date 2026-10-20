let csrfToken = null;
export const setCsrf = (token) => {
  csrfToken = token;
};
export class ApiError extends Error {
  constructor(message, status = 0, code = 'NETWORK_ERROR', fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}
export async function api(path, { method = 'GET', body, headers = {}, signal, blob = false } = {}) {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 40000);
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', abort, { once: true });
  try {
    const response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        ...(method !== 'GET'
          ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken || '' }
          : {}),
        ...headers,
      },
      ...(method !== 'GET' ? { body: JSON.stringify(body ?? {}) } : {}),
    });
    if (response.status === 204) return null;
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      if (response.status === 401 && !['/auth/login', '/auth/register', '/auth/me'].includes(path))
        window.dispatchEvent(new Event('cashbook:unauthenticated'));
      throw new ApiError(
        data.error?.message || 'Unable to complete the request.',
        response.status,
        data.error?.code,
        data.error?.fields,
      );
    }
    return blob ? response.blob() : response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (signal?.aborted) throw error;
    throw new ApiError(
      controller.signal.aborted
        ? 'The request timed out. Check your connection and try again.'
        : 'Cannot reach Cashbook. Check your internet connection and try again.',
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
export function queryString(values) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  return query.toString();
}
