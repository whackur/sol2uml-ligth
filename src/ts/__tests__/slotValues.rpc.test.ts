import axios from 'axios'
import type { AxiosResponse } from 'axios'
import { JsonRpcProvider } from 'ethers'
import { SlotValueCache } from '../SlotValueCache.js'
import { getSlotValues } from '../slotValues.js'

jest.mock('axios')

const mockedAxios = jest.mocked(axios)
const rpcUrl = 'https://rpc.example.test'
const contractAddress = '0x0000000000000000000000000000000000000001'

beforeEach(() => {
    SlotValueCache.clear()
    jest.spyOn(JsonRpcProvider.prototype, 'getCode').mockResolvedValue('0x01')
})

afterEach(() => {
    jest.restoreAllMocks()
})

describe('JSON-RPC slot fetching', () => {
    test('returns values in requested slot order when responses arrive out of order', async () => {
        mockedAxios.post.mockResolvedValueOnce({
            data: [
                {
                    id: '1',
                    jsonrpc: '2.0',
                    result: '0x' + '11'.repeat(32),
                },
                {
                    id: '0',
                    jsonrpc: '2.0',
                    result: '0x' + '22'.repeat(32),
                },
            ],
        } as AxiosResponse)

        const values = await getSlotValues(rpcUrl, contractAddress, [2, 1], 12)

        expect(values).toEqual(['0x' + '22'.repeat(32), '0x' + '11'.repeat(32)])
        expect(mockedAxios.post).toHaveBeenCalledWith(
            rpcUrl,
            expect.arrayContaining([
                expect.objectContaining({
                    method: 'eth_getStorageAt',
                    params: [contractAddress, '0x02', '0xc'],
                }),
                expect.objectContaining({
                    method: 'eth_getStorageAt',
                    params: [contractAddress, '0x01', '0xc'],
                }),
            ]),
        )
    })

    test('wraps a JSON-RPC slot error with the existing request context', async () => {
        mockedAxios.post.mockResolvedValueOnce({
            data: [
                {
                    id: '2',
                    jsonrpc: '2.0',
                    error: { code: -32000, message: 'slot unavailable' },
                },
            ],
        } as AxiosResponse)

        await expect(
            getSlotValues(rpcUrl, contractAddress, [1], 'latest'),
        ).rejects.toMatchObject({
            message: `Failed to get 1 storage values for contract ${contractAddress} from ${rpcUrl}`,
            cause: expect.objectContaining({
                message:
                    'json rpc call with id 2 failed to get storage values: slot unavailable',
            }),
        })
    })
})
