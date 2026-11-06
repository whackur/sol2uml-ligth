import { EtherscanParser } from '../index.js'

jest.setTimeout(30000)

const etherDelta = '0x8d12A197cB00D4747a1fe03395095ce2A5CC6819'
const describeWithApiKey = process.env.SCAN_API_KEY ? describe : describe.skip
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describeWithApiKey('Etherscan API integration', () => {
    beforeEach(async () => {
        await sleep(2000)
    })

    test('gets source code for a single-file contract', async () => {
        const etherscan = new EtherscanParser(process.env.SCAN_API_KEY)
        const sourceCode = await etherscan.getSourceCode(
            '0xBB9bc244D798123fDe783fCc1C72d3Bb8C189413',
        )

        expect(sourceCode.files).toHaveLength(1)
        expect(sourceCode.contractName).toEqual('DAO')
        expect(sourceCode.compilerVersion).toEqual('v0.3.1-2016-04-12-3ad5e82')
    })

    test('gets source code files', async () => {
        const etherscan = new EtherscanParser(process.env.SCAN_API_KEY)
        const sourceCode = await etherscan.getSourceCode(
            '0xc1fc9E5eC3058921eA5025D703CBE31764756319',
        )

        expect(sourceCode.files).toHaveLength(4)
        expect(sourceCode.contractName).toEqual('OETHMorphoAaveStrategyProxy')
        expect(sourceCode.compilerVersion).toEqual('v0.8.7+commit.e28d00a7')
    })

    test('gets a selected source file', async () => {
        const etherscan = new EtherscanParser(process.env.SCAN_API_KEY)
        const sourceCode = await etherscan.getSourceCode(
            '0xc1fc9E5eC3058921eA5025D703CBE31764756319',
            'InitializeGovernedUpgradeabilityProxy',
        )

        expect(sourceCode.files).toHaveLength(1)
        expect(sourceCode.contractName).toEqual('OETHMorphoAaveStrategyProxy')
        expect(sourceCode.compilerVersion).toEqual('v0.8.7+commit.e28d00a7')
    })

    test('parses UML classes', async () => {
        const etherscan = new EtherscanParser(process.env.SCAN_API_KEY)
        const { umlClasses } = await etherscan.getUmlClasses(etherDelta)

        expect(umlClasses).toHaveLength(7)
    })

    test('rejects a contract without verified source', async () => {
        expect.assertions(1)
        const etherscan = new EtherscanParser(process.env.SCAN_API_KEY)

        try {
            await etherscan.getUmlClasses(
                '0x0000000000000000000000000000000000000001',
            )
        } catch (err) {
            expect(err.message).toMatch(
                /Failed to get verified source code for address 0x0000000000000000000000000000000000000001 from Etherscan API/,
            )
        }
    })
})
