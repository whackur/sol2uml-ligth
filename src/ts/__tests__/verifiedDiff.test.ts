import type { EtherscanParser } from '../explorer/etherscan-parser.js'
import type { ExplorerSourceFile } from '../explorer/source-code-types.js'
import { diffVerifiedContracts } from '../diff/verified-contract-diff.js'
import type { DiffOptions } from '../diff/types.js'

const addressA = `0x${'a'.repeat(40)}`
const addressB = `0x${'b'.repeat(40)}`

const parserFor = (files: ExplorerSourceFile[], contractName: string) => {
    const getSourceCode = jest.fn(async () => ({
        files,
        contractName,
        compilerVersion: '0.8.38',
        remappings: [],
    }))

    return {
        parser: { getSourceCode } as unknown as EtherscanParser,
        getSourceCode,
    }
}

const options = (overrides: Partial<DiffOptions> = {}): DiffOptions => ({
    network: 'ethereum',
    lineBuffer: 2,
    ...overrides,
})

describe('Verified contract diff selection', () => {
    test('compares a renamed selected source and keeps the A filename', async () => {
        const sourceA = 'contract Before {}'
        const sourceB = 'contract After {}'
        const parserA = parserFor(
            [
                { filename: 'contracts/Old.sol', code: sourceA },
                { filename: 'contracts/Other.sol', code: 'contract Other {}' },
            ],
            'Contract A',
        )
        const parserB = parserFor(
            [
                { filename: 'contracts/New.sol', code: sourceB },
                {
                    filename: 'contracts/Unrelated.sol',
                    code: 'contract Other {}',
                },
            ],
            'Contract B',
        )

        const result = await diffVerifiedContracts(
            addressA,
            addressB,
            parserA.parser,
            parserB.parser,
            options({ aFile: 'contracts/Old.sol', bFile: 'contracts/New.sol' }),
        )

        expect(result).toEqual({
            files: [
                {
                    filename: 'contracts/Old.sol',
                    aCode: sourceA,
                    bCode: sourceB,
                    result: 'changed',
                },
            ],
            contractNameA: 'Contract A',
            contractNameB: 'Contract B',
        })
        expect(parserA.getSourceCode).toHaveBeenCalledWith(addressA)
        expect(parserB.getSourceCode).toHaveBeenCalledWith(addressB)
    })

    test('defaults B to the exact A path and excludes unrelated sources', async () => {
        const selectedSource = 'contract Selected {}'
        const parserA = parserFor(
            [
                { filename: 'src/Selected.sol', code: selectedSource },
                { filename: 'src/Other.sol', code: 'contract Before {}' },
            ],
            'Contract A',
        )
        const parserB = parserFor(
            [
                { filename: 'src/Selected.sol', code: selectedSource },
                { filename: 'src/Other.sol', code: 'contract After {}' },
                { filename: 'src/Added.sol', code: 'contract Added {}' },
            ],
            'Contract B',
        )

        const { files } = await diffVerifiedContracts(
            addressA,
            addressB,
            parserA.parser,
            parserB.parser,
            options({ aFile: 'src/Selected.sol' }),
        )

        expect(files).toEqual([
            {
                filename: 'src/Selected.sol',
                aCode: selectedSource,
                bCode: selectedSource,
                result: 'match',
            },
        ])
    })

    test('selects by full path when source files share a basename', async () => {
        const selectedSource = 'contract V2 {}'
        const renamedSource = 'contract VendorV2 {}'
        const parserA = parserFor(
            [
                { filename: 'src/v1/Token.sol', code: 'contract V1 {}' },
                { filename: 'src/v2/Token.sol', code: selectedSource },
            ],
            'Contract A',
        )
        const parserB = parserFor(
            [
                { filename: 'vendor/Token.sol', code: renamedSource },
                { filename: 'src/v1/Token.sol', code: 'contract V1 {}' },
            ],
            'Contract B',
        )

        const { files } = await diffVerifiedContracts(
            addressA,
            addressB,
            parserA.parser,
            parserB.parser,
            options({
                aFile: 'src/v2/Token.sol',
                bFile: 'vendor/Token.sol',
            }),
        )

        expect(files).toEqual([
            {
                filename: 'src/v2/Token.sol',
                aCode: selectedSource,
                bCode: renamedSource,
                result: 'changed',
            },
        ])
    })

    test('errors when the exact renamed B path is missing', async () => {
        const parserA = parserFor(
            [{ filename: 'src/Old.sol', code: 'contract Old {}' }],
            'Contract A',
        )
        const parserB = parserFor(
            [{ filename: 'src/Other.sol', code: 'contract Other {}' }],
            'Contract B',
        )

        await expect(
            diffVerifiedContracts(
                addressA,
                addressB,
                parserA.parser,
                parserB.parser,
                options({
                    aFile: 'src/Old.sol',
                    bFile: 'src/New.sol',
                }),
            ),
        ).rejects.toThrow(
            /Could not find source file "src\/New\.sol" in contract B/,
        )
    })

    test.each([
        [
            'missing A path',
            [],
            [{ filename: 'src/Selected.sol', code: 'contract Selected {}' }],
            /Could not find source file "src\/Selected\.sol" in contract A/,
        ],
        [
            'missing B path',
            [{ filename: 'src/Selected.sol', code: 'contract Selected {}' }],
            [],
            /Could not find source file "src\/Selected\.sol" in contract B/,
        ],
        [
            'ambiguous A path',
            [
                { filename: 'src/Selected.sol', code: 'contract First {}' },
                { filename: 'src/Selected.sol', code: 'contract Second {}' },
            ],
            [{ filename: 'src/Selected.sol', code: 'contract Selected {}' }],
            /Found 2 source files with exact path "src\/Selected\.sol" in contract A/,
        ],
        [
            'ambiguous B path',
            [{ filename: 'src/Selected.sol', code: 'contract Selected {}' }],
            [
                { filename: 'src/Selected.sol', code: 'contract First {}' },
                { filename: 'src/Selected.sol', code: 'contract Second {}' },
            ],
            /Found 2 source files with exact path "src\/Selected\.sol" in contract B/,
        ],
    ])(
        'reports a clear error for %s',
        async (_name, filesA, filesB, errorMessage) => {
            const parserA = parserFor(
                filesA as ExplorerSourceFile[],
                'Contract A',
            )
            const parserB = parserFor(
                filesB as ExplorerSourceFile[],
                'Contract B',
            )

            await expect(
                diffVerifiedContracts(
                    addressA,
                    addressB,
                    parserA.parser,
                    parserB.parser,
                    options({ aFile: 'src/Selected.sol' }),
                ),
            ).rejects.toThrow(errorMessage as RegExp)
        },
    )

    test('keeps whole-tree removed and added results when no A file is selected', async () => {
        const parserA = parserFor(
            [{ filename: 'src/Old.sol', code: 'contract Old {}' }],
            'Contract A',
        )
        const parserB = parserFor(
            [{ filename: 'src/New.sol', code: 'contract New {}' }],
            'Contract B',
        )

        const { files } = await diffVerifiedContracts(
            addressA,
            addressB,
            parserA.parser,
            parserB.parser,
            options(),
        )

        expect(files).toEqual([
            {
                filename: 'src/New.sol',
                bCode: 'contract New {}',
                result: 'added',
            },
            {
                filename: 'src/Old.sol',
                aCode: 'contract Old {}',
                result: 'removed',
            },
        ])
    })

    test('preserves whole-tree behavior when only B file is provided', async () => {
        const parserA = parserFor(
            [{ filename: 'src/Old.sol', code: 'contract Old {}' }],
            'Contract A',
        )
        const parserB = parserFor(
            [{ filename: 'src/New.sol', code: 'contract New {}' }],
            'Contract B',
        )

        const { files } = await diffVerifiedContracts(
            addressA,
            addressB,
            parserA.parser,
            parserB.parser,
            options({ bFile: 'src/New.sol' }),
        )

        expect(files).toEqual([
            {
                filename: 'src/New.sol',
                bCode: 'contract New {}',
                result: 'added',
            },
            {
                filename: 'src/Old.sol',
                aCode: 'contract Old {}',
                result: 'removed',
            },
        ])
    })
})
