import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'fs/promises'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, relative } from 'path'

import {
    convertClasses2StorageSections,
    getSolidityFilesFromFolderOrFile,
    isFile,
    isFolder,
} from '../index.js'
import { parseUmlClassesFromFiles } from '../index.js'
import { parseFoundryTomlRemappings } from '../filesystem/foundry-remappings.js'
import { UmlClass } from '../umlClass.js'

const canCreateSymlink = (kind: 'directory' | 'file'): boolean => {
    if (process.platform !== 'win32') return true

    const tempDirectory = mkdtempSync(join(tmpdir(), 'sol2uml-symlink-probe-'))
    try {
        const target = join(
            tempDirectory,
            kind === 'directory' ? 'target' : 'target.sol',
        )
        if (kind === 'directory') mkdirSync(target)
        else writeFileSync(target, '')

        symlinkSync(
            target,
            join(tempDirectory, 'link'),
            kind === 'directory' ? 'junction' : 'file',
        )
        return true
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code
        if (['EACCES', 'EPERM', 'ENOTSUP'].includes(code ?? '')) return false
        throw error
    } finally {
        rmSync(tempDirectory, { recursive: true, force: true })
    }
}

const directorySymlinkTest = canCreateSymlink('directory') ? test : test.skip
const fileSymlinkTest = canCreateSymlink('file') ? test : test.skip

describe('Parser', () => {
    test('keeps class ids interleaved across concurrent parses', async () => {
        const originalIdCounter = UmlClass.idCounter
        let tempDirectory: string | undefined
        try {
            UmlClass.idCounter = 0
            tempDirectory = await mkdtemp(
                join(tmpdir(), 'sol2uml-concurrent-parser-'),
            )
            await Promise.all([
                writeFile(join(tempDirectory, 'A.sol'), 'contract A {}'),
                writeFile(join(tempDirectory, 'B.sol'), 'contract B {}'),
            ])
            const sourceFiles = [
                join(tempDirectory, 'A.sol'),
                join(tempDirectory, 'B.sol'),
            ]

            const [firstParse, secondParse] = await Promise.all([
                parseUmlClassesFromFiles(sourceFiles, []),
                parseUmlClassesFromFiles(sourceFiles, []),
            ])

            expect(firstParse.map(({ id }) => id).sort()).toEqual([0, 2])
            expect(secondParse.map(({ id }) => id).sort()).toEqual([1, 3])
            expect(firstParse.map(({ name }) => name).sort()).toEqual([
                'A',
                'B',
            ])
            expect(secondParse.map(({ name }) => name).sort()).toEqual([
                'A',
                'B',
            ])
        } finally {
            UmlClass.idCounter = originalIdCounter
            if (tempDirectory) {
                await rm(tempDirectory, { recursive: true, force: true })
            }
        }
    })

    directorySymlinkTest(
        'resolves aliased nested types through a symlinked source directory',
        async () => {
            const originalIdCounter = UmlClass.idCounter
            let tempDirectory: string | undefined
            try {
                UmlClass.idCounter = 42
                tempDirectory = await mkdtemp(
                    join(tmpdir(), 'sol2uml-symlink-parser-'),
                )
                const realDirectory = join(tempDirectory, 'real')
                const symlinkDirectory = join(tempDirectory, 'alias')
                await mkdir(realDirectory)
                await writeFile(
                    join(realDirectory, 'Defs.sol'),
                    `pragma solidity 0.8.38;
                 library Wrong { struct S { uint8 x; } }
                 library Right { struct S { uint256 x; uint256 y; } }`,
                )
                await writeFile(
                    join(realDirectory, 'Use.sol'),
                    `pragma solidity 0.8.38;
                 import {Right as Alias} from "./Defs.sol";
                 contract Use { Alias.S value; uint256 tail; }`,
                )
                await writeFile(
                    join(realDirectory, 'foundry.toml'),
                    'remappings = ["./Defs.sol=Defs.sol"]',
                )

                await symlink(
                    realDirectory,
                    symlinkDirectory,
                    process.platform === 'win32' ? 'junction' : 'dir',
                )

                const usePath = join(symlinkDirectory, 'Use.sol')
                const realDefinitionsPath = await realpath(
                    join(realDirectory, 'Defs.sol'),
                )
                const umlClasses = await parseUmlClassesFromFiles(
                    [usePath, realDefinitionsPath],
                    [],
                )
                const realUsePath = await realpath(
                    join(realDirectory, 'Use.sol'),
                )
                const useClass = umlClasses.find(
                    (umlClass) => umlClass.name === 'Use',
                )!
                const rightClass = umlClasses.find(
                    (umlClass) => umlClass.name === 'Right',
                )!

                expect(useClass.absolutePath).toBe(realUsePath)
                expect(useClass.relativePath).toBe(
                    relative(process.cwd(), usePath),
                )
                expect(useClass.imports[0].absolutePath).toBe(
                    realDefinitionsPath,
                )
                expect(rightClass.absolutePath).toBe(realDefinitionsPath)
                expect(useClass.imports[0].absolutePath).toBe(
                    rightClass.absolutePath,
                )

                const [contractSection] = convertClasses2StorageSections(
                    'Use',
                    [...umlClasses].reverse(),
                    1,
                )
                expect(contractSection.variables).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({
                            name: 'value',
                            fromSlot: 0,
                            toSlot: 1,
                            byteSize: 64,
                        }),
                        expect.objectContaining({ name: 'tail', fromSlot: 2 }),
                    ]),
                )
            } finally {
                UmlClass.idCounter = originalIdCounter
                if (tempDirectory) {
                    await rm(tempDirectory, { recursive: true, force: true })
                }
            }
        },
    )

    test('parses quoted Foundry remappings and ignores comments or invalid entries', () => {
        const remappings = parseFoundryTomlRemappings(
            `remappings = [\n  "@lib/=lib/",\n  # ignored\n  "[/=target",\n]`,
        )

        expect(remappings.map(({ from, to }) => [from.source, to])).toEqual([
            ['^@lib\\/', 'lib/'],
        ])
    })

    describe('getSolidityFilesFromFolderOrFile', () => {
        directorySymlinkTest(
            'discovers Solidity files under a symlinked directory root using its logical path',
            async () => {
                const tempDirectory = await mkdtemp(
                    join(tmpdir(), 'sol2uml-directory-alias-'),
                )
                try {
                    const targetRoot = join(tempDirectory, 'target-root')
                    const logicalRoot = join(tempDirectory, 'logical-root')
                    await mkdir(join(targetRoot, 'nested'), { recursive: true })
                    await writeFile(join(targetRoot, 'Root.sol'), '')
                    await writeFile(
                        join(targetRoot, 'nested', 'Nested.sol'),
                        '',
                    )
                    await symlink(
                        targetRoot,
                        logicalRoot,
                        process.platform === 'win32' ? 'junction' : 'dir',
                    )

                    const files =
                        await getSolidityFilesFromFolderOrFile(logicalRoot)
                    expect(files.sort()).toEqual(
                        [
                            join(logicalRoot, 'Root.sol'),
                            join(logicalRoot, 'nested', 'Nested.sol'),
                        ].sort(),
                    )
                    expect(isFolder(logicalRoot)).toBe(true)
                    expect(isFile(logicalRoot)).toBe(false)
                } finally {
                    await rm(tempDirectory, { recursive: true, force: true })
                }
            },
        )

        fileSymlinkTest(
            'keeps the input path for an explicit Solidity file symlink',
            async () => {
                const tempDirectory = await mkdtemp(
                    join(tmpdir(), 'sol2uml-file-alias-'),
                )
                try {
                    const targetFile = join(tempDirectory, 'Target.sol')
                    const logicalFile = join(tempDirectory, 'Alias.sol')
                    await writeFile(targetFile, '')
                    await symlink(targetFile, logicalFile, 'file')

                    expect(
                        await getSolidityFilesFromFolderOrFile(logicalFile),
                    ).toEqual([logicalFile])
                    expect(isFile(logicalFile)).toBe(true)
                    expect(isFolder(logicalFile)).toBe(false)
                } finally {
                    await rm(tempDirectory, { recursive: true, force: true })
                }
            },
        )

        test('excludes ignored child files and directories by basename', async () => {
            const tempDirectory = await mkdtemp(
                join(tmpdir(), 'sol2uml-ignore-parser-'),
            )
            try {
                const root = join(tempDirectory, 'contracts')
                await mkdir(join(root, 'skip-dir'), { recursive: true })
                await writeFile(join(root, 'Keep.sol'), '')
                await writeFile(join(root, 'Skip.sol'), '')
                await writeFile(join(root, 'skip-dir', 'Hidden.sol'), '')

                expect(
                    await getSolidityFilesFromFolderOrFile(root, [
                        'Skip.sol',
                        'skip-dir',
                    ]),
                ).toEqual([join(root, 'Keep.sol')])
            } finally {
                await rm(tempDirectory, { recursive: true, force: true })
            }
        })

        test('limits depth zero to files directly under the input root', async () => {
            const tempDirectory = await mkdtemp(
                join(tmpdir(), 'sol2uml-depth-parser-'),
            )
            try {
                const root = join(tempDirectory, 'contracts')
                await mkdir(join(root, 'nested'), { recursive: true })
                await writeFile(join(root, 'Root.sol'), '')
                await writeFile(join(root, 'nested', 'Nested.sol'), '')

                expect(
                    await getSolidityFilesFromFolderOrFile(root, [], 0),
                ).toEqual([join(root, 'Root.sol')])
            } finally {
                await rm(tempDirectory, { recursive: true, force: true })
            }
        })

        directorySymlinkTest(
            'does not follow nested symlinks back to the traversal root',
            async () => {
                const tempDirectory = await mkdtemp(
                    join(tmpdir(), 'sol2uml-cycle-parser-'),
                )
                let timeout: NodeJS.Timeout | undefined
                try {
                    const root = join(tempDirectory, 'contracts')
                    const nested = join(root, 'nested')
                    await mkdir(nested, { recursive: true })
                    await writeFile(join(root, 'Root.sol'), '')
                    await writeFile(join(nested, 'Nested.sol'), '')
                    await symlink(
                        root,
                        join(nested, 'back-to-root'),
                        process.platform === 'win32' ? 'junction' : 'dir',
                    )

                    const files = await Promise.race([
                        getSolidityFilesFromFolderOrFile(root),
                        new Promise<never>((_, reject) => {
                            timeout = setTimeout(
                                () =>
                                    reject(
                                        new Error(
                                            'File discovery did not finish around the symlink cycle',
                                        ),
                                    ),
                                2_000,
                            )
                        }),
                    ])
                    expect(files.sort()).toEqual(
                        [
                            join(root, 'Root.sol'),
                            join(nested, 'Nested.sol'),
                        ].sort(),
                    )
                } finally {
                    if (timeout) clearTimeout(timeout)
                    await rm(tempDirectory, { recursive: true, force: true })
                }
            },
        )

        test('does not include a directory whose name ends in .sol as a file', async () => {
            const tempDirectory = await mkdtemp(
                join(tmpdir(), 'sol2uml-sol-directory-parser-'),
            )
            try {
                const root = join(tempDirectory, 'contracts')
                const solidityDirectory = join(root, 'Directory.sol')
                await mkdir(solidityDirectory, { recursive: true })
                await writeFile(join(root, 'Actual.sol'), '')
                await writeFile(join(solidityDirectory, 'Nested.sol'), '')

                const files = await getSolidityFilesFromFolderOrFile(root)
                expect(files).toEqual([
                    join(root, 'Actual.sol'),
                    join(solidityDirectory, 'Nested.sol'),
                ])
                expect(files).not.toContain(solidityDirectory)
            } finally {
                await rm(tempDirectory, { recursive: true, force: true })
            }
        })

        fileSymlinkTest(
            'rejects broken file symlink roots and file-kind helpers return false',
            async () => {
                const tempDirectory = await mkdtemp(
                    join(tmpdir(), 'sol2uml-broken-root-'),
                )
                try {
                    const targetFile = join(tempDirectory, 'Target.sol')
                    const brokenFile = join(tempDirectory, 'Broken.sol')
                    await writeFile(targetFile, '')
                    await symlink(targetFile, brokenFile, 'file')
                    await rm(targetFile)

                    await expect(
                        getSolidityFilesFromFolderOrFile(brokenFile),
                    ).rejects.toThrow(/No such file or folder/)
                    expect(isFile(brokenFile)).toBe(false)
                    expect(isFolder(brokenFile)).toBe(false)
                } finally {
                    await rm(tempDirectory, { recursive: true, force: true })
                }
            },
        )

        test('get Solidity files from contracts folder', async () => {
            const files =
                await getSolidityFilesFromFolderOrFile('./src/contracts')
            expect(files).toHaveLength(40)
        })

        test('get Solidity files from folder with no sol files', async () => {
            const files = await getSolidityFilesFromFolderOrFile('./src/ts')
            expect(files).toHaveLength(0)
        })

        test('get Solidity file', async () => {
            const files = await getSolidityFilesFromFolderOrFile(
                './src/contracts/Caller.sol',
            )
            expect(files).toHaveLength(1)
        })

        describe('Failures', () => {
            test("Reading a file that doesn't exist", async () => {
                expect.assertions(1)

                try {
                    await getSolidityFilesFromFolderOrFile(
                        './FleDoesNotExist.sol',
                    )
                } catch (err) {
                    expect(err.message).toMatch(/No such file or folder/)
                }
            })

            test("Reading a file that doesn't have a sol extension", async () => {
                expect.assertions(1)

                try {
                    await getSolidityFilesFromFolderOrFile('./package.json')
                } catch (err) {
                    expect(err.message).toMatch(
                        /does not have a .sol extension/,
                    )
                }
            })
        })
    })
})
