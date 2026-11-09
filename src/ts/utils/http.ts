// Archive nodes can be slow on large storage batches, so this stays well above typical latency.
export const HTTP_TIMEOUT_MS = 120_000

export class HttpStatusError extends Error {
    constructor(
        readonly status: number,
        readonly statusText: string,
    ) {
        super(`HTTP status code ${status}, status text: ${statusText}`)
        this.name = 'HttpStatusError'
    }
}

export type HttpFailureReason =
    'timeout' | 'invalid-url' | 'invalid-json' | 'network'

// Deliberately has no cause: fetch and URL errors embed the full URL, which can carry API keys.
export class HttpRequestError extends Error {
    constructor(
        readonly reason: HttpFailureReason,
        url: string,
        detail?: string,
    ) {
        super(
            `HTTP request to ${redactUrl(url)} failed: ${reason}${detail ? ` (${detail})` : ''}`,
        )
        this.name = 'HttpRequestError'
    }
}

// Node and explorer URLs often embed API keys in the path, query, or userinfo.
export const redactUrl = (url: string): string => {
    try {
        const parsed = new URL(url)
        const hasSecretParts =
            parsed.pathname.length > 1 ||
            parsed.search !== '' ||
            parsed.username !== '' ||
            parsed.password !== ''
        return hasSecretParts ? `${parsed.origin}/<REDACTED>` : parsed.origin
    } catch {
        return '<REDACTED>'
    }
}

// fetch rejects URLs with userinfo, so move it into a Basic auth header like axios did.
const splitCredentials = (
    url: string | URL,
): { requestUrl: URL; authorization?: string } => {
    const requestUrl = new URL(url)
    if (!requestUrl.username && !requestUrl.password) return { requestUrl }
    const user = decodeURIComponent(requestUrl.username)
    const password = decodeURIComponent(requestUrl.password)
    requestUrl.username = ''
    requestUrl.password = ''
    const token = Buffer.from(`${user}:${password}`).toString('base64')
    return { requestUrl, authorization: `Basic ${token}` }
}

const errorCode = (err: unknown): string | undefined => {
    const cause = (err as { cause?: { code?: unknown } })?.cause
    return typeof cause?.code === 'string' ? cause.code : undefined
}

export const fetchJson = async (
    url: string | URL,
    init: RequestInit = {},
    timeoutMs: number = HTTP_TIMEOUT_MS,
): Promise<unknown> => {
    const urlText = String(url)
    let parts: ReturnType<typeof splitCredentials>
    try {
        parts = splitCredentials(url)
    } catch {
        throw new HttpRequestError('invalid-url', urlText)
    }
    const headers = new Headers(init.headers)
    if (parts.authorization) headers.set('Authorization', parts.authorization)

    let response: Response
    try {
        response = await fetch(parts.requestUrl, {
            ...init,
            headers,
            signal: AbortSignal.timeout(timeoutMs),
        })
    } catch (err) {
        if (isTimeoutError(err)) {
            throw new HttpRequestError('timeout', urlText, `${timeoutMs}ms`)
        }
        throw new HttpRequestError('network', urlText, errorCode(err))
    }
    if (!response.ok) {
        throw new HttpStatusError(response.status, response.statusText)
    }
    try {
        return await response.json()
    } catch (err) {
        if (isTimeoutError(err)) {
            throw new HttpRequestError('timeout', urlText, `${timeoutMs}ms`)
        }
        throw new HttpRequestError('invalid-json', urlText)
    }
}

export const postJson = (
    url: string,
    body: unknown,
    timeoutMs?: number,
): Promise<unknown> =>
    fetchJson(
        url,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        },
        timeoutMs,
    )

export const isTimeoutError = (err: unknown): boolean =>
    err instanceof Error && err.name === 'TimeoutError'
