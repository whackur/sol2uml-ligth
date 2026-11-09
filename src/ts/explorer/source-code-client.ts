import { fetchJson, HttpRequestError, redactUrl } from '../network/http.js'
import {
    EXPLORER_RATE_LIMIT_RETRY_DELAY_MS,
    EXPLORER_SOURCE_CODE_MAX_RETRIES,
} from './constants.js'

const debug = require('debug')('sol2uml-light')

export const requestSourceCode = async (
    url: string,
    apiKey: string | undefined,
    contractAddress: string,
): Promise<unknown> => {
    debug(
        `About to get Solidity source code for ${contractAddress} from ${redactUrl(url)}`,
    )

    let requestUrl: URL
    try {
        requestUrl = new URL(url)
    } catch {
        throw new HttpRequestError('invalid-url', url)
    }
    requestUrl.searchParams.set('module', 'contract')
    requestUrl.searchParams.set('action', 'getsourcecode')
    requestUrl.searchParams.set('address', contractAddress)
    if (apiKey) requestUrl.searchParams.set('apikey', apiKey)

    let data: unknown
    for (
        let attempt = 1;
        attempt <= EXPLORER_SOURCE_CODE_MAX_RETRIES;
        attempt++
    ) {
        data = await fetchJson(requestUrl)

        const result = (data as { result?: unknown } | null)?.result
        if (
            typeof result === 'string' &&
            result.includes('rate limit') &&
            attempt < EXPLORER_SOURCE_CODE_MAX_RETRIES
        ) {
            const delay = attempt * EXPLORER_RATE_LIMIT_RETRY_DELAY_MS
            debug(
                `Rate limited on attempt ${attempt}. Retrying in ${delay}ms...`,
            )
            await new Promise((resolve) => setTimeout(resolve, delay))
            continue
        }
        break
    }

    return data
}
