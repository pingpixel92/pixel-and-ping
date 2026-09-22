'use client'

/**
 * Centralized API client.
 * All responses follow { success: true, data } | { success: false, error: { code, message } }.
 */

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

interface ApiEnvelope<T> {
  success: boolean
  data?: T
  error?: { code: string; message: string }
}

const SKIP_REDIRECT = ['/api/auth', '/api/me', '/api/setup']

export async function api<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method: opts.method ?? 'GET',
      headers: opts.body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
      credentials: 'same-origin',
      cache: 'no-store',
    })
  } catch (err) {
    throw new ApiClientError(0, 'NETWORK', err instanceof Error && err.name === 'AbortError' ? 'Request aborted' : 'Network error — check your connection.')
  }

  let envelope: ApiEnvelope<T>
  try {
    envelope = (await res.json()) as ApiEnvelope<T>
  } catch {
    throw new ApiClientError(res.status, 'BAD_RESPONSE', 'Server returned an unreadable response.')
  }

  if (!res.ok || envelope.success !== true) {
    const code = envelope.error?.code ?? 'UNKNOWN'
    const message = envelope.error?.message ?? 'Request failed.'
    if (res.status === 401 && typeof window !== 'undefined' && !SKIP_REDIRECT.some((p) => path.startsWith(p))) {
      window.location.href = '/login'
    }
    throw new ApiClientError(res.status, code, message)
  }
  return envelope.data as T
}

export interface ListResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
