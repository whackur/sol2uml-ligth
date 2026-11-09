import { SlotValueCache } from '../slot-values/slot-value-cache.js'
import { getSlotValues } from '../slotValues.js'
import { RPC_BATCH_SIZE } from '../network/jsonRpc.js'

const rpcUrl = 'https://rpc.example.test/v2/secret-key'
const contractAddress = '0x0000000000000000000000000000000000000001'

type RpcRequest = { id: number; method: string; params: unknown[] }

const jsonResponse = (body: unknown): Response =>
    new Response(JSON.stringify(body), { status: 200 })

// Answers eth_getCode, then lets each test shape eth_getStorageAt batch responses.
const mockRpc = (
    batchHandler: (requests: RpcRequest[]) => unknown,
): jest.SpyInstance => {
    return jest
        .spyOn(globalThis, 'fetch')
        .mockImplementation(async (_url, init) => {
            const body = JSON.parse(String(init?.body))
            if (!Array.isArray(body)) {
                return jsonResponse({
                    jsonrpc: '2.0',
                    id: body.id,
                    result: '0x01',
                })
            }
            return jsonResponse(batchHandler(body))
        })
}

beforeEach(() => {
    SlotValueCache.clear()
})

afterEach(() => {
    jest.restoreAllMocks()
})

describe('JSON-RPC slot fetching', () => {
    test('returns values in requested slot order when responses arrive out of order', async () => {
        const fetchSpy = mockRpc((requests) =>
            requests
                .map((request) => ({
                    jsonrpc: '2.0',
                    id: request.id,
                    result:
                        '0x' + String(request.params[1]).slice(2).repeat(32),
                }))
                .reverse(),
        )

        const values = await getSlotValues(rpcUrl, contractAddress, [2, 1], 12)

        expect(values).toEqual(['0x' + '02'.repeat(32), '0x' + '01'.repeat(32)])
        const batch = JSON.parse(String(fetchSpy.mock.calls[1][1]?.body))
        expect(batch).toEqual([
            expect.objectContaining({
                method: 'eth_getStorageAt',
                params: [contractAddress, '0x02', '0xc'],
            }),
            expect.objectContaining({
                method: 'eth_getStorageAt',
                params: [contractAddress, '0x01', '0xc'],
            }),
        ])
    })

    test('splits large slot requests into bounded batches', async () => {
        const fetchSpy = mockRpc((requests) =>
            requests.map((request) => ({
                jsonrpc: '2.0',
                id: request.id,
                result: '0x' + '00'.repeat(32),
            })),
        )
        const slotCount = RPC_BATCH_SIZE * 2 + 1
        const slots = Array.from({ length: slotCount }, (_, i) => i)

        const values = await getSlotValues(rpcUrl, contractAddress, slots)

        expect(values).toHaveLength(slotCount)
        const batchSizes = fetchSpy.mock.calls
            .slice(1)
            .map(([, init]) => JSON.parse(String(init?.body)).length)
        expect(batchSizes).toEqual([RPC_BATCH_SIZE, RPC_BATCH_SIZE, 1])
    })

    test('wraps a JSON-RPC slot error without exposing the node URL secret', async () => {
        mockRpc((requests) => [
            {
                jsonrpc: '2.0',
                id: requests[0].id,
                error: { code: -32000, message: 'slot unavailable' },
            },
        ])

        const error = await getSlotValues(
            rpcUrl,
            contractAddress,
            [1],
            'latest',
        ).catch((err: Error) => err)

        expect(error).toMatchObject({
            message: `Failed to get 1 storage values for contract ${contractAddress} from https://rpc.example.test/<REDACTED>`,
            cause: expect.objectContaining({
                message: expect.stringMatching(
                    /^json rpc call with id \d+ failed: slot unavailable$/,
                ),
            }),
        })
        expect(String((error as Error).message)).not.toContain('secret-key')
    })
})
