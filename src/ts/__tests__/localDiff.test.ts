import {
    mkdirSync,
    mkdtempSync,
    realpathSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from 'fs'
import { join, relative, sep } from 'path'
import { tmpdir } from 'os'

import type { EtherscanParser } from '../explorer/etherscan-parser.js'
import type { ExplorerSourceFile } from '../explorer/source-code-types.js'
import { diffVerified2Local } from '../diff/local-contract-diff.js'

const contractSource = (contractName: string): string =>
    `pragma solidity 0.8.38;\n\ncontract ${contractName} {}`

const cwdRelativePath = (path: string): string =>
    relative(process.cwd(), path).split(sep).join('/')

const parserFor = (files: ExplorerSourceFile[]): EtherscanParser =>
    ({
        getSourceCode: async () => ({
            files,
            contractName: 'LocalDiff',
            compilerVersion: '0.8.38',
            remappings: [],
        }),
    }) as unknown as EtherscanParser

const address = `0x${'1'.repeat(40)}`

describe('Verified source compared to local Solidity files', () => {
    let tempRoot: string

    beforeEach(() => {
        tempRoot = mkdtempSync(join(tmpdir(), 'sol2uml-local-diff-'))
    })

    afterEach(() => {
        rmSync(tempRoot, { recursive: true, force: true })
    })

    test('reports match, change, removal, and addition in filename order', async () => {
        const root = join(tempRoot, 'contracts')
        mkdirSync(join(root, 'src'), { recursive: true })
        mkdirSync(join(root, 'new'))
        writeFileSync(join(root, 'src', 'Match.sol'), contractSource('Match'))
        writeFileSync(
            join(root, 'src', 'Changed.sol'),
            contractSource('LocalVersion'),
        )
        const addedPath = join(root, 'new', 'Added.sol')
        writeFileSync(addedPath, contractSource('Added'))

        const { files } = await diffVerified2Local(
            address,
            parserFor([
                {
                    filename: 'src/Match.sol',
                    code: contractSource('Match'),
                },
                {
                    filename: 'src/Changed.sol',
                    code: contractSource('VerifiedVersion'),
                },
                {
                    filename: 'src/Removed.sol',
                    code: contractSource('Removed'),
                },
            ]),
            [root],
        )

        expect(files.map(({ filename, result }) => [filename, result])).toEqual(
            [
                [cwdRelativePath(addedPath), 'added'],
                ['src/Changed.sol', 'changed'],
                ['src/Match.sol', 'match'],
                ['src/Removed.sol', 'removed'],
            ],
        )
    })

    test('matches a Solidity file passed by an explicit relative path', async () => {
        const filePath = join(tempRoot, 'Foo.sol')
        const code = contractSource('Foo')
        writeFileSync(filePath, code)
        const filename = cwdRelativePath(filePath)

        const { files } = await diffVerified2Local(
            address,
            parserFor([{ filename, code }]),
            [filename],
        )

        expect(files).toEqual([
            {
                filename,
                aCode: code,
                bCode: code,
                result: 'match',
            },
        ])
    })

    test('does not pair an explicit file with a different source path of the same basename', async () => {
        const explicitFile = join(tempRoot, 'contracts', 'Main.sol')
        const otherFile = join(tempRoot, 'other', 'Main.sol')
        const explicitCode = contractSource('Explicit')
        const otherCode = contractSource('Other')
        mkdirSync(join(tempRoot, 'contracts'), { recursive: true })
        mkdirSync(join(tempRoot, 'other'))
        writeFileSync(explicitFile, explicitCode)
        writeFileSync(otherFile, otherCode)
        const sourceFilename = cwdRelativePath(otherFile)
        const explicitFilename = cwdRelativePath(explicitFile)

        const { files } = await diffVerified2Local(
            address,
            parserFor([{ filename: sourceFilename, code: otherCode }]),
            [explicitFilename],
        )

        expect(files).toEqual(
            [
                {
                    filename: sourceFilename,
                    aCode: otherCode,
                    result: 'removed',
                },
                {
                    filename: explicitFilename,
                    bCode: explicitCode,
                    result: 'added',
                },
            ].sort((a, b) => a.filename.localeCompare(b.filename)),
        )
    })

    test('keeps flat address comparisons on one explicit Solidity file', async () => {
        const filePath = join(tempRoot, 'Flat.sol')
        const code = contractSource('Flat')
        writeFileSync(filePath, code)

        const result = await diffVerified2Local(
            address,
            parserFor([{ filename: address, code }]),
            [filePath],
        )

        expect(result).toEqual({
            files: [
                {
                    filename: address,
                    aCode: code,
                    bCode: code,
                    result: 'match',
                },
            ],
            contractNameA: 'LocalDiff',
            local: 'file',
        })
    })

    test('rejects a folder for a flat address source', async () => {
        const folderPath = join(tempRoot, 'contracts')
        mkdirSync(folderPath)

        await expect(
            diffVerified2Local(
                address,
                parserFor([
                    { filename: address, code: contractSource('Flat') },
                ]),
                [folderPath],
            ),
        ).rejects.toThrow(/single, flat file.*cannot be compared.*folder/)
    })

    test('deduplicates nested scan roots and reports unique cwd-relative names', async () => {
        const workspace = join(tempRoot, 'workspace')
        const firstRoot = join(workspace, 'packages', 'first')
        const secondRoot = join(workspace, 'packages', 'second')
        const nestedRoot = join(workspace, 'node_modules')
        mkdirSync(firstRoot, { recursive: true })
        mkdirSync(secondRoot, { recursive: true })
        mkdirSync(nestedRoot, { recursive: true })

        const firstFile = join(firstRoot, 'Foo.sol')
        const secondFile = join(secondRoot, 'Foo.sol')
        const nestedFile = join(nestedRoot, 'Nested.sol')
        writeFileSync(firstFile, contractSource('First'))
        writeFileSync(secondFile, contractSource('Second'))
        writeFileSync(nestedFile, contractSource('Nested'))

        const { files } = await diffVerified2Local(address, parserFor([]), [
            workspace,
            nestedRoot,
            firstRoot,
        ])

        const filenames = files.map((file) => file.filename)
        expect(filenames).toEqual(
            [firstFile, nestedFile, secondFile]
                .map(cwdRelativePath)
                .sort((a, b) => a.localeCompare(b)),
        )
        expect(new Set(filenames).size).toBe(3)
        expect(files.every((file) => file.result === 'added')).toBe(true)
    })

    const canCreateDirectorySymlinks = (() => {
        const root = mkdtempSync(join(tmpdir(), 'sol2uml-symlink-check-'))
        const target = join(root, 'target')
        const link = join(root, 'link')
        mkdirSync(target)
        try {
            symlinkSync(target, link, 'dir')
            return true
        } catch (error) {
            if (
                process.platform === 'win32' &&
                ['EPERM', 'EACCES'].includes(
                    (error as NodeJS.ErrnoException).code ?? '',
                )
            ) {
                return false
            }
            throw error
        } finally {
            rmSync(root, { recursive: true, force: true })
        }
    })()

    const symlinkTest = canCreateDirectorySymlinks ? test : test.skip

    symlinkTest(
        'uses canonical identity across a symlinked ancestor',
        async () => {
            const root = join(tempRoot, 'workspace')
            const physicalFolder = join(root, 'packages', 'contracts')
            const linkedFolder = join(root, 'node_modules', 'contracts')
            mkdirSync(physicalFolder, { recursive: true })
            mkdirSync(join(root, 'node_modules'), { recursive: true })
            const filePath = join(physicalFolder, 'Foo.sol')
            const code = contractSource('Foo')
            writeFileSync(filePath, code)
            symlinkSync(physicalFolder, linkedFolder, 'dir')

            const { files } = await diffVerified2Local(
                address,
                parserFor([
                    { filename: 'node_modules/contracts/Foo.sol', code },
                    { filename: 'packages/contracts/Foo.sol', code },
                ]),
                [root],
            )

            expect(files).toEqual(
                [
                    'node_modules/contracts/Foo.sol',
                    'packages/contracts/Foo.sol',
                ].map((filename) => ({
                    filename,
                    aCode: code,
                    bCode: code,
                    result: 'match',
                })),
            )
        },
    )

    symlinkTest(
        'deduplicates a logical scan root and a native explicit file path',
        async () => {
            const physicalFolder = join(tempRoot, 'packages', 'contracts')
            const logicalFolder = join(tempRoot, 'node_modules', 'contracts')
            mkdirSync(physicalFolder, { recursive: true })
            mkdirSync(join(tempRoot, 'node_modules'), { recursive: true })
            const filePath = join(physicalFolder, 'Foo.sol')
            const code = contractSource('Foo')
            writeFileSync(filePath, code)
            symlinkSync(physicalFolder, logicalFolder, 'dir')

            const { files } = await diffVerified2Local(
                address,
                parserFor([{ filename: 'Foo.sol', code }]),
                [logicalFolder, realpathSync.native(filePath)],
            )

            expect(files).toEqual([
                {
                    filename: 'Foo.sol',
                    aCode: code,
                    bCode: code,
                    result: 'match',
                },
            ])
        },
    )

    test('excludes ignored local files from additions while retaining ignored-source removals', async () => {
        const root = join(tempRoot, 'contracts')
        mkdirSync(root)
        const ignoredFile = join(root, 'Ignored.sol')
        const addedFile = join(root, 'Added.sol')
        writeFileSync(ignoredFile, contractSource('Ignored'))
        writeFileSync(addedFile, contractSource('Added'))

        const { files } = await diffVerified2Local(
            address,
            parserFor([
                {
                    filename: 'Ignored.sol',
                    code: contractSource('Ignored'),
                },
            ]),
            [root],
            ['Ignored.sol'],
        )

        expect(files).toEqual(
            [
                {
                    filename: cwdRelativePath(addedFile),
                    bCode: contractSource('Added'),
                    result: 'added',
                },
                {
                    filename: 'Ignored.sol',
                    aCode: contractSource('Ignored'),
                    result: 'removed',
                },
            ].sort((a, b) =>
                (a.filename ?? '').localeCompare(b.filename ?? ''),
            ),
        )
        expect(files.map((file) => file.filename)).not.toContain(
            cwdRelativePath(ignoredFile),
        )
    })
})
