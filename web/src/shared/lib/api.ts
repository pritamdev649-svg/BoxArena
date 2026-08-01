/**
 * Server-side API client for the panels.
 *
 * Panels are Server Components, so they call the backend directly rather than
 * through the browser. That keeps the access token out of client JS entirely
 * (technical_spec.md §4.3).
 */

const BASE_URL =
  process.env['API_INTERNAL_BASE_URL'] ??
  process.env['NEXT_PUBLIC_API_BASE_URL'] ??
  'http://localhost:5000/api/v1';

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
}

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: any,
  ) {
    super(message);
  }
}

export interface ApiOptions {
  /** Explicitly `| undefined`: callers pass a token that may be absent, and
      exactOptionalPropertyTypes distinguishes that from omitting the key. */
  token?: string | undefined;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /**
   * Required by every financial mutation (api_contract.md §25). Replaying the
   * same key returns the original result instead of charging twice.
   */
  idempotencyKey?: string | undefined;
}

function buildInit(options: ApiOptions): RequestInit {
  return {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    /** Panels show live operational data — never serve it from a cache. */
    cache: 'no-store',
  };
}

/**
 * Request tracing, off unless `API_DEBUG=true`.
 *
 * Bodies are redacted before they are printed: these payloads carry access
 * tokens, refresh tokens and OTP codes, and a terminal scrollback or a captured
 * CI log is a credential leak. Tracing that you cannot safely leave on is
 * tracing you will turn off and lose.
 */
const REDACTED_KEYS = new Set([
  'accessToken',
  'refreshToken',
  'code',
  'otpCode',
  'devCode',
  'signature',
  'phoneNumber',
]);

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value !== 'object' || value === null) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, inner]) => [
      key,
      REDACTED_KEYS.has(key) ? '[redacted]' : redact(inner),
    ]),
  );
}

function trace(message: string, payload?: unknown): void {
  if (process.env['API_DEBUG'] !== 'true') return;
  if (payload === undefined) console.warn(message);
  else console.warn(message, JSON.stringify(redact(payload)));
}

/**
 * A non-JSON body means a proxy, a crash page or an HTML error — surface it as
 * a real ApiError rather than an opaque "Unexpected token <" parse failure.
 */
async function readEnvelope<T>(response: Response, label: string): Promise<ApiEnvelope<T>> {
  const raw = await response.text();
  try {
    return JSON.parse(raw) as ApiEnvelope<T>;
  } catch {
    console.error(`[api] non-JSON response ${label} ${response.status}`, raw.slice(0, 200));
    throw new ApiError(
      'INTERNAL_ERROR',
      `The server returned a non-JSON response (${response.status})`,
      response.status,
    );
  }
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const startedAt = Date.now();

  trace(`[api] --> ${method} ${path}`, options.body);

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, buildInit(options));
  } catch (err) {
    console.error(`[api] network error ${method} ${path}`, err);
    throw err;
  }

  const envelope = await readEnvelope<T>(response, `${method} ${path}`);
  trace(`[api] <-- ${method} ${path} ${response.status} (${Date.now() - startedAt}ms)`, envelope);

  if (!response.ok || !envelope.success) {
    throw new ApiError(
      envelope.error?.code ?? 'INTERNAL_ERROR',
      envelope.error?.message ?? 'Request failed',
      response.status,
      envelope.error?.details,
    );
  }

  return envelope.data as T;
}

/** Returns null instead of throwing, for panels that degrade gracefully. */
export async function apiFetchSafe<T>(path: string, options: ApiOptions = {}): Promise<T | null> {
  try {
    return await apiFetch<T>(path, options);
  } catch {
    return null;
  }
}
