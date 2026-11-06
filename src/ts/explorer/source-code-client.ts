import axios from 'axios'
import type { AxiosResponse } from 'axios'

import {
    EXPLORER_RATE_LIMIT_RETRY_DELAY_MS,
    EXPLORER_SOURCE_CODE_MAX_RETRIES,
} from './constants.js'

require('axios-debug-log')
const debug = require('debug')('sol2uml-light')

export const requestSourceCode = async (
    url: string,
    apiKey: string | undefined,
    contractAddress: string,
): Promise<AxiosResponse<unknown>> => {
    debug(
        `About to get Solidity source code for ${contractAddress} from ${url}`,
    )

    let response: AxiosResponse<unknown> | undefined
    for (
        let attempt = 1;
        attempt <= EXPLORER_SOURCE_CODE_MAX_RETRIES;
        attempt++
    ) {
        response = await axios.get<unknown>(url, {
            params: {
                module: 'contract',
                action: 'getsourcecode',
                address: contractAddress,
                apikey: apiKey,
            },
        })

        const responseData = response.data as { result?: unknown } | null
        const result = responseData?.result
        if (
            !Array.isArray(result) &&
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

    return response as AxiosResponse<unknown>
}
