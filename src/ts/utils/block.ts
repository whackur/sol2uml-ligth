import { parseBlockNumber } from '../explorer/block-number.js'
import { redactUrl } from './http.js'
import { assertHexQuantity, rpcRequest } from './jsonRpc.js'

const debug = require('debug')('sol2uml-light')

export const getBlock = async (options: {
    block: string
    url: string
    network: string
}): Promise<number> => {
    if (options.block === 'latest') {
        try {
            const block = Number(
                assertHexQuantity(
                    await rpcRequest(options.url, 'eth_blockNumber', []),
                    'eth_blockNumber',
                ),
            )
            debug(
                `Latest block is ${block}. All storage slot values will be from this block.`,
            )
            return block
        } catch (err) {
            const defaultMessage =
                options.url === 'http://localhost:8545'
                    ? 'This is the default url. Use the `-u, --url` option or `NODE_URL` environment variable to set the url of your blockchain node.'
                    : `Check your --url option or NODE_URL environment variable is pointing to the correct node for the "${options.network}" blockchain.`

            throw Error(
                `Failed to connect to blockchain node with url ${redactUrl(options.url)}.\n${defaultMessage}`,
                { cause: err },
            )
        }
    }
    return parseBlockNumber(options.block)
}
