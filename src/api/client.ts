import { API_BASE_URL } from '../config';
import { getToken } from './tokens';
import type {
  Bundle,
  InstanceDetail,
  MediaCompleteRequest,
  MediaCompleteResponse,
  MediaIntentRequest,
  MediaIntentResponse,
  MeResponse,
  SyncRequest,
  SyncResponse,
  TokenRequest,
  TokenResponse,
  ApiErrorBody,
} from './types';

/**
 * A failed API call. Carries the parsed error envelope so callers can show the
 * localized message and surface field-level validation errors.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiErrorBody | null
  ) {
    super(body?.message ?? `HTTP ${status}`);
    this.name = 'ApiError';
  }

  get validationErrors(): Record<string, string[]> {
    return this.body?.errors ?? {};
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Attach the stored bearer token (default true). */
  auth?: boolean;
  idempotencyKey?: string;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, idempotencyKey } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (auth) {
    const token = await getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  const json = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiError(response.status, json as ApiErrorBody | null);
  }

  return json as T;
}

/**
 * The `/api/v1` capture surface. Form design, species linking, analysis and
 * export stay on the web and are intentionally absent here.
 */
export const api = {
  createToken: (payload: TokenRequest) =>
    request<TokenResponse>('/tokens', { method: 'POST', body: payload, auth: false }),

  revokeCurrentToken: () =>
    request<{ message: string }>('/tokens/current', { method: 'DELETE' }),

  me: () => request<MeResponse>('/me'),

  bundle: (projectId: number, since?: string) =>
    request<Bundle>(
      `/projects/${projectId}/bundle${since ? `?since=${encodeURIComponent(since)}` : ''}`
    ),

  syncInstances: (projectId: number, payload: SyncRequest, idempotencyKey?: string) =>
    request<SyncResponse>(`/projects/${projectId}/instances:sync`, {
      method: 'POST',
      body: payload,
      idempotencyKey,
    }),

  getInstance: (instanceId: string) =>
    request<InstanceDetail>(`/instances/${instanceId}`),

  mediaIntent: (instanceId: string, payload: MediaIntentRequest) =>
    request<MediaIntentResponse>(`/instances/${instanceId}/media/intent`, {
      method: 'POST',
      body: payload,
    }),

  mediaComplete: (instanceId: string, payload: MediaCompleteRequest) =>
    request<MediaCompleteResponse>(`/instances/${instanceId}/media/complete`, {
      method: 'POST',
      body: payload,
    }),
};
