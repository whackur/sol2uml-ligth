import { postJson } from './http.js'

// Many hosted nodes reject batches above 100 to 1000 calls.
export const RPC_BATCH_SIZE = 100

export interface JsonRpcCall {
    method: string
    params: unknown[]
}

interface JsonRpcResponse {
    id: number | string
    result?: unknown
    error?: { code: number; message: string }
}

let nextId = 0

const hexData = /^0x[0-9a-fA-F]*$/
const hexQuantity = /^0x[0-9a-fA-F]+$/

export const assertHexData = (value: unknown, method: string): string => {
    if (typeof value !== 'string' || !hexData.test(value)) {
        throw Error(`Invalid ${method} result ${JSON.stringify(value)}`)
    }
    return value
}

export const assertHexQuantity = (value: unknown, method: string): bigint => {
    if (typeof value !== 'string' || !hexQuantity.test(value)) {
        throw Error(`Invalid ${method} result ${JSON.stringify(value)}`)
    }
    return BigInt(value)
}

export const rpcRequest = async <T>(
    url: string,
    method: string,
    params: unknown[],
): Promise<T> => {
    const response = (await postJson(url, {
        jsonrpc: '2.0',
        id: nextId++,
        method,
        params,
    })) as JsonRpcResponse
    if (response?.error) {
        throw Error(`json rpc call ${method} failed: ${response.error.message}`)
    }
    return response?.result as T
}

export const rpcBatch = async (
    url: string,
    calls: readonly JsonRpcCall[],
    batchSize: number = RPC_BATCH_SIZE,
): Promise<unknown[]> => {
    const results: unknown[] = []
    for (let start = 0; start < calls.length; start += batchSize) {
        const requests = calls
            .slice(start, start + batchSize)
            .map((call) => ({ jsonrpc: '2.0', id: nextId++, ...call }))
        const response = await postJson(url, requests)
        if (!Array.isArray(response)) {
            const message = (response as JsonRpcResponse)?.error?.message
            throw Error(message ?? 'Invalid json rpc batch response')
        }
        if (response.length !== requests.length) {
            throw Error(
                `Requested ${requests.length} json rpc calls but only got ${response.length} responses`,
            )
        }
        // Batch responses can arrive in a different order than their requests.
        const responsesById = new Map(
            (response as JsonRpcResponse[]).map((r) => [String(r?.id), r]),
        )
        // Servers answer unparseable or invalid calls with id null.
        const unmatchedError = (response as JsonRpcResponse[]).find(
            (r) => r?.id == null && r?.error,
        )?.error
        for (const request of requests) {
            const matched = responsesById.get(String(request.id))
            if (!matched) {
                throw Error(
                    `Missing json rpc response for id ${request.id}${unmatchedError ? `: ${unmatchedError.message}` : ''}`,
                )
            }
            if (matched.error) {
                throw Error(
                    `json rpc call with id ${request.id} failed: ${matched.error.message}`,
                )
            }
            results.push(matched.result)
        }
    }
    return results
}
