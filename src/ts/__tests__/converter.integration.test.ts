import { convertUmlClasses2Dot, EtherscanParser } from '../index.js'
import { convertDot2Svg } from '../output/writer.js'

const etherDelta = '0x8d12A197cB00D4747a1fe03395095ce2A5CC6819'

describe('Converter integration', () => {
    test('Parse EtherDelta from Etherscan and convert to svg string', async () => {
        const etherscan = new EtherscanParser(process.env.SCAN_API_KEY)

        const { umlClasses } = await etherscan.getUmlClasses(etherDelta)

        const dotString = convertUmlClasses2Dot(umlClasses)
        const svg = convertDot2Svg(dotString)

        expect(svg).toMatch(/xml version/)
        expect(svg).toMatch(/DOCTYPE svg PUBLIC/)
        expect(svg).toMatch(/ReserveToken/)
        expect(svg).toMatch(/EtherDelta/)
    }, 10000)
})
