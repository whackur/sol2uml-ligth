import { lstatSync, statSync } from 'fs'
import { readdir } from 'fs/promises'
import { basename, extname, join, relative, resolve as resolvePath } from 'path'
import { canonicalPath } from './canonical-path.js'

const debug = require('debug')('sol2uml-light')

export async function getSolidityFilesFromFolderOrFiles(
    folderOrFilePaths: readonly string[],
    ignoreFilesOrFolders: readonly string[],
    subfolders: number = -1,
): Promise<string[]> {
    let files: string[] = []
    for (const folderOrFilePath of folderOrFilePaths) {
        const result = await getSolidityFilesFromFolderOrFile(
            folderOrFilePath,
            ignoreFilesOrFolders,
            subfolders,
        )
        files = files.concat(result)
    }
    return files
}

export function getSolidityFilesFromFolderOrFile(
    folderOrFilePath: string,
    ignoreFilesOrFolders: readonly string[] = [],
    depthLimit: number = -1,
): Promise<string[]> {
    debug(`About to get Solidity files under ${folderOrFilePath}`)

    return new Promise<string[]>((resolve, reject) => {
        try {
            const inputRootStats = lstatSync(folderOrFilePath)
            const folderOrFile = inputRootStats.isSymbolicLink()
                ? statSync(folderOrFilePath)
                : inputRootStats
            if (folderOrFile.isDirectory()) {
                const symlinkRoot = inputRootStats.isSymbolicLink()
                const walkRoot = symlinkRoot
                    ? canonicalPath(folderOrFilePath)
                    : folderOrFilePath
                const toLogicalPath = (filePath: string): string =>
                    symlinkRoot
                        ? resolvePath(
                              folderOrFilePath,
                              relative(walkRoot, filePath),
                          )
                        : filePath
                const filter = (file: string): boolean =>
                    !ignoreFilesOrFolders.includes(
                        basename(toLogicalPath(file)),
                    )

                walkFiles(walkRoot, depthLimit, filter)
                    .then((walkedFiles) =>
                        resolve(
                            walkedFiles
                                .map(toLogicalPath)
                                .filter((file) => extname(file) === '.sol'),
                        ),
                    )
                    .catch(reject)
            } else if (folderOrFile.isFile()) {
                if (extname(folderOrFilePath) === '.sol') {
                    debug(`Got Solidity file to be parsed: ${folderOrFilePath}`)
                    resolve([folderOrFilePath])
                } else {
                    reject(
                        Error(
                            `File ${folderOrFilePath} does not have a .sol extension.`,
                        ),
                    )
                }
            } else {
                reject(
                    Error(
                        `Could not find directory or file ${folderOrFilePath}`,
                    ),
                )
            }
        } catch (err: unknown) {
            let error: Error
            if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
                error = Error(
                    `No such file or folder ${folderOrFilePath}. Make sure you pass in the root directory of the contracts`,
                )
            } else {
                error = new Error(
                    `Failed to get Solidity files under folder or file ${folderOrFilePath}`,
                    { cause: err },
                )
            }
            console.error(error)
            reject(error)
        }
    })
}

// Breadth-first walk that does not follow symlinks; depthLimit -1 is unlimited.
// Only regular files are returned because Foundry can create an output folder with a source file's name.
async function walkFiles(
    root: string,
    depthLimit: number,
    filter: (path: string) => boolean,
): Promise<string[]> {
    const files: string[] = []
    const dirs: { path: string; depth: number }[] = [
        { path: resolvePath(root), depth: 0 },
    ]
    for (let i = 0; i < dirs.length; i++) {
        const { path, depth } = dirs[i]
        for (const entry of await readdir(path, { withFileTypes: true })) {
            const child = join(path, entry.name)
            if (!filter(child)) continue
            if (entry.isFile()) {
                files.push(child)
            } else if (
                entry.isDirectory() &&
                (depthLimit < 0 || depth < depthLimit)
            ) {
                dirs.push({ path: child, depth: depth + 1 })
            }
        }
    }
    return files
}
