import { inspect } from 'util'
import { fetchJson, HttpRequestError, redactUrl } from '../http.js'
import { getBlock } from '../block.js'
import { getSlotValues } from '../../slotValues.js'
import { SlotValueCache } from '../../slot-values/slot-value-cache.js'
import { EtherscanParser } from '../../parserEtherscan.js'

const secret = 'super-secret-key'

const failureText = async (promise: Promise<unknown>): Promise<string> => {
    const err = await promise.then(
        () => {
            throw Error('expected a rejection')
        },
        (e: unknown) => e,
    )
    return inspect(err, { depth: null })
}

afterEach(() => {
    jest.restoreAllMocks()
    SlotValueCache.clear()
})

describe('redactUrl', () => {
    test('keeps only the origin when the URL can carry secrets', () => {
        expect(redactUrl('http://localhost:8545')).toBe('http://localhost:8545')
        expect(redactUrl('https://user:pw@node.test')).toBe(
            'https://node.test/<REDACTED>',
        )
        expect(redactUrl('https://node.test/v3/key?apikey=x')).toBe(
            'https://node.test/<REDACTED>',
        )
        expect(redactUrl('not a url')).toBe('<REDACTED>')
    })
})

describe('fetchJson', () => {
    test('does not leak a malformed URL through the error or its causes', async () => {
        const text = await failureText(
            fetchJson(`https//node.test/v2/${secret}`),
        )
        expect(text).toContain('invalid-url')
        expect(text).not.toContain(secret)
    })

    test('does not leak userinfo or path secrets from network failures', async () => {
        jest.spyOn(globalThis, 'fetch').mockRejectedValue(
            Object.assign(
                new TypeError(`fetch failed https://node.test/${secret}`),
                {
                    cause: {
                        code: 'ECONNREFUSED',
                        input: `https://node.test/${secret}`,
                    },
                },
            ),
        )
        const text = await failureText(
            fetchJson(`https://user:${secret}@node.test/v2/${secret}`),
        )
        expect(text).toContain('ECONNREFUSED')
        expect(text).not.toContain(secret)
    })

    test('sends URL credentials as a Basic auth header', async () => {
        const fetchSpy = jest
            .spyOn(globalThis, 'fetch')
            .mockResolvedValue(new Response('{"ok":true}'))

        await fetchJson('https://user:p%40ss@node.test/rpc')

        const [requestUrl, init] = fetchSpy.mock.calls[0]
        expect(String(requestUrl)).toBe('https://node.test/rpc')
        expect(new Headers(init?.headers).get('Authorization')).toBe(
            'Basic ' + Buffer.from('user:p@ss').toString('base64'),
        )
    })

    test('reports a non-JSON body as invalid-json', async () => {
        jest.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response('<html>'),
        )
        await expect(fetchJson('https://node.test')).rejects.toBeInstanceOf(
            HttpRequestError,
        )
    })
})

describe('JSON-RPC result validation', () => {
    const rpcUrl = 'https://node.test'
    const address = '0x0000000000000000000000000000000000000001'

    test('rejects a null eth_blockNumber instead of using block 0', async () => {
        jest.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response('{"jsonrpc":"2.0","id":0,"result":null}'),
        )
        await expect(
            getBlock({ block: 'latest', url: rpcUrl, network: 'ethereum' }),
        ).rejects.toThrow(/Failed to connect/)
    })

    test('rejects a null storage value without caching it', async () => {
        jest.spyOn(globalThis, 'fetch').mockImplementation(
            async (_url, init) => {
                const body = JSON.parse(String(init?.body))
                return new Response(
                    JSON.stringify(
                        Array.isArray(body)
                            ? body.map((r) => ({
                                  jsonrpc: '2.0',
                                  id: r.id,
                                  result: null,
                              }))
                            : { jsonrpc: '2.0', id: body.id, result: '0x01' },
                    ),
                )
            },
        )
        await expect(getSlotValues(rpcUrl, address, [1])).rejects.toThrow()
        expect(SlotValueCache.readSlotValues([1]).missingKeys).toEqual(['0x01'])
    })
})

describe('Explorer requests', () => {
    test('do not leak a malformed explorer URL or API key', async () => {
        const parser = new EtherscanParser(
            secret,
            'ethereum',
            `https//explorer.test/${secret}`,
        )
        const text = await failureText(
            parser.getSourceCode('0x0000000000000000000000000000000000000001'),
        )
        expect(text).toContain('invalid-url')
        expect(text).not.toContain(secret)
    })
})
