import axios from 'axios'
import { JsonRpcProvider, toQuantity } from 'ethers'
import type { BigNumberish } from 'ethers'
import { SlotValueCache } from '../SlotValueCache.js'

interface StorageAtResponse {
    jsonrpc: '2.0'
    id: string
    result?: string
    error?: { code: number; message: string }
}

const debug = require('debug')('sol2uml-light')

// JSON-RPC batch IDs continue across calls in the process.
let jsonRpcId = 0
export const getSlotValues = async (
    url: string,
    contractAddress: string,
    slotKeys: readonly BigNumberish[],
    blockTag: BigNumberish | 'latest' = 'latest',
): Promise<string[]> => {
    try {
        if (slotKeys.length === 0) {
            return []
        }
        const block =
            blockTag === 'latest' ? blockTag : toQuantity(BigInt(blockTag))

        const { cachedValues, missingKeys } =
            SlotValueCache.readSlotValues(slotKeys)

        if (missingKeys.length === 0) {
            return cachedValues
        }

        const provider = new JsonRpcProvider(url)

        const code = await provider.getCode(contractAddress, block)
        if (!code || code === '0x') {
            const msg = `Address ${contractAddress} has no code. Check your "-u, --url" option or "NODE_URL" environment variable is pointing to the correct node.\nurl: ${url}`
            console.error(msg)
            throw Error(msg)
        }

        debug(
            `About to get ${
                slotKeys.length
            } storage values for ${contractAddress} at block ${blockTag} from slot ${missingKeys[0].toString()}`,
        )
        const payload = missingKeys.map((key) => ({
            id: (jsonRpcId++).toString(),
            jsonrpc: '2.0',
            method: 'eth_getStorageAt',
            params: [contractAddress, key, block],
        }))
        const response = await axios.post(url, payload)

        if (response.data?.error?.message) {
            throw Error(response.data.error.message)
        }
        if (response.data.length !== missingKeys.length) {
            throw Error(
                `Requested ${missingKeys.length} storage slot values but only got ${response.data.length}`,
            )
        }
        const responseData = response.data as StorageAtResponse[]
        // Batch responses can arrive in a different order than their requests.
        const sortedResponses = responseData.sort(
            (a, b) => Number(a.id) - Number(b.id),
        )
        const missingValues = sortedResponses.map((data) => {
            if (data.error) {
                throw Error(
                    `json rpc call with id ${data.id} failed to get storage values: ${data.error?.message}`,
                )
            }
            return '0x' + data.result.toUpperCase().slice(2)
        })
        return SlotValueCache.addSlotValues(
            slotKeys,
            missingKeys,
            missingValues,
        )
    } catch (err) {
        throw Error(
            `Failed to get ${slotKeys.length} storage values for contract ${contractAddress} from ${url}`,
            { cause: err },
        )
    }
}

export const getSlotValue = async (
    url: string,
    contractAddress: string,
    slotKey: BigNumberish,
    blockTag: BigNumberish | 'latest',
) => {
    debug(`About to get storage slot ${slotKey} value for ${contractAddress}`)

    const values = await getSlotValues(
        url,
        contractAddress,
        [slotKey],
        blockTag,
    )

    return values[0]
}
