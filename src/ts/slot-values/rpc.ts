import type { BigNumberish } from '../utils/evm.js'
import { toQuantity } from '../utils/evm.js'
import { redactUrl } from '../network/http.js'
import { assertHexData, rpcBatch, rpcRequest } from '../network/jsonRpc.js'
import { SlotValueCache } from './slot-value-cache.js'

const debug = require('debug')('sol2uml-light')

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

        const code = assertHexData(
            await rpcRequest(url, 'eth_getCode', [contractAddress, block]),
            'eth_getCode',
        )
        if (!code || code === '0x') {
            const msg = `Address ${contractAddress} has no code. Check your "-u, --url" option or "NODE_URL" environment variable is pointing to the correct node.\nurl: ${redactUrl(url)}`
            console.error(msg)
            throw Error(msg)
        }

        debug(
            `About to get ${
                slotKeys.length
            } storage values for ${contractAddress} at block ${blockTag} from slot ${missingKeys[0].toString()}`,
        )
        const results = await rpcBatch(
            url,
            missingKeys.map((key) => ({
                method: 'eth_getStorageAt',
                params: [contractAddress, key, block],
            })),
        )
        const missingValues = results.map(
            (result) =>
                '0x' +
                assertHexData(result, 'eth_getStorageAt')
                    .toUpperCase()
                    .slice(2),
        )
        return SlotValueCache.addSlotValues(
            slotKeys,
            missingKeys,
            missingValues,
        )
    } catch (err) {
        throw Error(
            `Failed to get ${slotKeys.length} storage values for contract ${contractAddress} from ${redactUrl(url)}`,
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
