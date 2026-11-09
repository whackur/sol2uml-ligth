import { getSlotValue, getSlotValues } from '../slotValues.js'
import { SlotValueCache } from '../slot-values/slot-value-cache.js'

const emissionController = '0xBa69e6FC7Df49a3b75b565068Fb91ff2d9d91780'
const usdc = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const musd = '0xe2f2a5c287993345a840db3b0845fbc70f5935a5'

const url = process.env.NODE_URL ?? ''

const integrationDescribe = process.env.NODE_URL ? describe : describe.skip

integrationDescribe('Slot Values integration (requires NODE_URL)', () => {
    beforeEach(() => {
        SlotValueCache.clear()
    })
    test('Emissions controller first slot latest', async () => {
        expect(
            await getSlotValue(url, emissionController, 1, '15272562'),
        ).toEqual(
            '0x00000000000000000000000000000000000000000000000000000AB700000A96',
        )
    })
    test('Emissions controller first slot on deployment', async () => {
        expect(
            await getSlotValue(url, emissionController, 1, 13761579),
        ).toEqual(
            '0x00000000000000000000000000000000000000000000000000000A9600000A96',
        )
    })
    test('Emissions controller first slot before deployment', async () => {
        await expect(
            getSlotValue(url, emissionController, 1, 13761570),
        ).rejects.toThrow(Error)
    })
    test('USDC second slot', async () => {
        expect(await getSlotValue(url, usdc, 0, 'latest')).toEqual(
            '0x000000000000000000000000FCB19E6A322B27C06842A71E8C725399F049AE3A',
        )
    })
    test('mUSD proxy admin slot', async () => {
        expect(
            await getSlotValue(
                url,
                musd,
                '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103',
                'latest',
            ),
        ).toEqual(
            '0x0000000000000000000000005C8EB57B44C1C6391FC7A8A0CF44D26896F92386',
        )
    })
    test('Emissions Controller batch', async () => {
        const values = await getSlotValues(
            url,
            emissionController,
            [
                0,
                1,
                2,
                3,
                4,
                5,
                6,
                '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103',
            ],
            '15272562',
        )
        expect(values).toEqual([
            '0x0000000000000000000000000000000000000000000000000000000000000001',
            '0x00000000000000000000000000000000000000000000000000000AB700000A96',
            '0x0000000000000000000000000000000000000000000000000000000000000000',
            '0x0000000000000000000000000000000000000000000000000000000000000002',
            '0x0000000000000000000000000000000000000000000000000000000000000013',
            '0x0000000000000000000000000000000000000000000000000000000000000000',
            '0x0000000000000000000000000000000000000000000000000000000000000000',
            '0x0000000000000000000000005C8EB57B44C1C6391FC7A8A0CF44D26896F92386',
        ])
    })
    test('Emissions Controller reserve slot order', async () => {
        const values = await getSlotValues(
            url,
            emissionController,
            [2, 1, 0],
            '15272562',
        )
        expect(values).toEqual([
            '0x0000000000000000000000000000000000000000000000000000000000000000',
            '0x00000000000000000000000000000000000000000000000000000AB700000A96',
            '0x0000000000000000000000000000000000000000000000000000000000000001',
        ])
    })
})
