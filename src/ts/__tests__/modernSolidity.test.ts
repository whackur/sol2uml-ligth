import { readFile } from 'fs/promises'
import { join } from 'path'

import { convertUmlClasses2Dot, parseUmlClassesFromFiles } from '../index.js'

const solc = require('solc') as {
    version: () => string
    compile: (input: string) => string
}

const fixtureDirectory = join(process.cwd(), 'tests/contracts/modern')
const bigintSourcePath = 'src/contracts/libraries/BigInt.sol'

const targets = [
    {
        file: 'OsakaFeatures.sol',
        contract: 'OsakaFeatures',
        evmVersion: 'osaka',
        expectedFunctions: [
            'writeTransient',
            'readTransient',
            'copyBytes',
            'blobParameters',
        ],
        expectedOpcodes: [
            'TSTORE',
            'TLOAD',
            'MCOPY',
            'BLOBHASH',
            'BLOBBASEFEE',
        ],
    },
    {
        file: 'AmsterdamFeatures.sol',
        contract: 'AmsterdamFeatures',
        evmVersion: 'amsterdam',
        expectedFunctions: ['currentSlotNumber', 'currentSlotNumberAssembly'],
        expectedOpcodes: ['SLOTNUM'],
    },
] as const

describe('modern Solidity compiler compatibility', () => {
    beforeAll(() => {
        expect(solc.version().split('+')[0]).toBe('0.8.38')
    })

    describe.each(targets)('$evmVersion target', (target) => {
        test.each([false, true])(
            `compiles ${target.contract} for ${target.evmVersion} with viaIR=%s`,
            async (viaIR) => {
                const source = await readFile(
                    join(fixtureDirectory, target.file),
                    'utf8',
                )
                const bigintSource = await readFile(
                    join(process.cwd(), bigintSourcePath),
                    'utf8',
                )
                const input = {
                    language: 'Solidity',
                    sources: {
                        [target.file]: { content: source },
                        [bigintSourcePath]: { content: bigintSource },
                    },
                    settings: {
                        evmVersion: target.evmVersion,
                        ...(target.evmVersion === 'amsterdam'
                            ? { experimental: true }
                            : {}),
                        optimizer: { enabled: true, runs: 200 },
                        viaIR,
                        outputSelection: {
                            '*': {
                                '*': [
                                    'metadata',
                                    'evm.bytecode.object',
                                    'evm.deployedBytecode.opcodes',
                                ],
                            },
                        },
                    },
                }
                const output = JSON.parse(
                    solc.compile(JSON.stringify(input)),
                ) as {
                    errors?: { severity: string; formattedMessage: string }[]
                    contracts?: Record<
                        string,
                        Record<
                            string,
                            {
                                metadata?: string
                                evm?: {
                                    bytecode?: { object?: string }
                                    deployedBytecode?: { opcodes?: string }
                                }
                            }
                        >
                    >
                }
                const errors = (output.errors ?? []).filter(
                    ({ severity }) => severity === 'error',
                )
                const compiledContract =
                    output.contracts?.[target.file]?.[target.contract]
                const compiledBigInt =
                    output.contracts?.[bigintSourcePath]?.BigInt

                expect(errors).toEqual([])
                expect(compiledBigInt?.evm?.bytecode?.object).toMatch(
                    /^[0-9a-f]+$/,
                )
                expect(compiledBigInt?.metadata).toBeDefined()
                expect(
                    JSON.parse(compiledBigInt!.metadata!).settings.evmVersion,
                ).toBe(target.evmVersion)
                expect(compiledContract?.evm?.bytecode?.object).toMatch(
                    /^[0-9a-f]+$/,
                )
                for (const opcode of target.expectedOpcodes) {
                    expect(
                        compiledContract?.evm?.deployedBytecode?.opcodes,
                    ).toContain(opcode)
                }
                expect(compiledContract?.metadata).toBeDefined()
                expect(
                    JSON.parse(compiledContract!.metadata!).settings.evmVersion,
                ).toBe(target.evmVersion)
            },
        )

        test('parses functions and renders the class diagram', async () => {
            const sourcePath = join(fixtureDirectory, target.file)
            const umlClasses = await parseUmlClassesFromFiles([sourcePath], [])
            const contract = umlClasses.find(
                ({ name }) => name === target.contract,
            )

            expect(contract).toBeDefined()
            expect(contract!.operators.map(({ name }) => name)).toEqual(
                expect.arrayContaining([...target.expectedFunctions]),
            )

            const diagram = convertUmlClasses2Dot(umlClasses)
            expect(diagram).toContain(target.contract)
            for (const functionName of target.expectedFunctions) {
                expect(diagram).toContain(functionName)
            }
        })
    })
})
