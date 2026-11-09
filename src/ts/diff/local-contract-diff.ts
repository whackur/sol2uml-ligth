import { relative, resolve, sep } from 'path'

import type { EtherscanParser } from '../explorer/etherscan-parser.js'
import {
    getSolidityFilesFromFolderOrFiles,
    isFile,
    isFolder,
    readFile,
} from '../parserFiles.js'
import { isAddress } from '../utils/regEx.js'
import type { CompareContracts, DiffFiles } from './types.js'
import { compareSourceCode } from './source-comparison.js'
import { canonicalPath } from '../filesystem/canonical-path.js'

export const diffVerified2Local = async (
    addressA: string,
    etherscanParserA: EtherscanParser,
    fileOrBaseFolders: string[],
    ignoreFilesOrFolders: string[] = [],
): Promise<CompareContracts> => {
    const files: DiffFiles[] = []
    const { files: aFiles, contractName: contractNameA } =
        await etherscanParserA.getSourceCode(addressA)

    if (aFiles.length === 1 && isAddress(aFiles[0].filename)) {
        const aFile = aFiles[0]
        const bFile = fileOrBaseFolders[0]
        if (isFolder(bFile)) {
            throw Error(
                `Contract with address ${addressA} is a single, flat file so cannot be compared to a local files under folder(s) "${fileOrBaseFolders.toString()}".`,
            )
        }

        const bCode = readFile(bFile, 'sol')
        files.push(compareSourceCode(aFile.filename, aFile.code, bCode))
        return {
            files,
            contractNameA,
            local: 'file',
        }
    }

    const bFiles = await getSolidityFilesFromFolderOrFiles(
        fileOrBaseFolders,
        ignoreFilesOrFolders,
    )
    const localFiles = new Map<string, string>()
    for (const bFile of bFiles) {
        const lexicalPath = resolve(process.cwd(), bFile)
        let realPath: string
        try {
            realPath = canonicalPath(lexicalPath)
        } catch (err) {
            throw new Error(`Failed to resolve local Solidity file ${bFile}`, {
                cause: err,
            })
        }
        if (!localFiles.has(realPath)) {
            localFiles.set(realPath, lexicalPath)
        }
    }
    const matchedFiles = new Set<string>()

    for (const aFile of aFiles) {
        let bFileRealPath: string | undefined
        for (const baseFolder of fileOrBaseFolders) {
            try {
                const basePath = resolve(process.cwd(), baseFolder)
                let aFileRealPath: string
                if (isFile(basePath)) {
                    const sourceRealPath = canonicalPath(
                        resolve(process.cwd(), aFile.filename),
                    )
                    const explicitFileRealPath = canonicalPath(basePath)
                    if (sourceRealPath !== explicitFileRealPath) continue
                    aFileRealPath = explicitFileRealPath
                } else {
                    // Resolve package symlinks to match the paths returned by the walker.
                    aFileRealPath = canonicalPath(
                        resolve(basePath, aFile.filename),
                    )
                }
                if (localFiles.has(aFileRealPath)) {
                    bFileRealPath = aFileRealPath
                    break
                }
            } catch {
                // Continue checking the other base folders.
            }
        }

        const bFile = bFileRealPath && localFiles.get(bFileRealPath)
        if (bFileRealPath && bFile) {
            matchedFiles.add(bFileRealPath)
            const bCode = readFile(bFile)
            files.push(compareSourceCode(aFile.filename, aFile.code, bCode))
        } else {
            files.push({
                filename: aFile.filename,
                aCode: aFile.code,
                result: 'removed',
            })
        }
    }

    for (const [realPath, lexicalPath] of localFiles) {
        if (matchedFiles.has(realPath)) continue
        files.push({
            filename: relative(process.cwd(), lexicalPath).split(sep).join('/'),
            bCode: readFile(lexicalPath),
            result: 'added',
        })
    }

    return {
        files: files.sort((a, b) => a.filename!.localeCompare(b.filename!)),
        contractNameA,
    }
}
