import { isAddress } from '../utils/regEx.js'
import type { ExplorerSourceFile } from '../explorer/source-code-types.js'
import type { DiffFiles } from './types.js'

export const compareSourceCode = (
    filename: string,
    aCode: string,
    bCode: string,
): DiffFiles => ({
    filename,
    aCode,
    bCode,
    result: aCode === bCode ? 'match' : 'changed',
})

export const compareVerifiedSourceFiles = (
    aFiles: ExplorerSourceFile[],
    bFiles: ExplorerSourceFile[],
): DiffFiles[] => {
    const files: DiffFiles[] = []
    if (
        aFiles.length === 1 &&
        bFiles.length === 1 &&
        isAddress(aFiles[0].filename)
    ) {
        files.push(
            compareSourceCode(
                `${aFiles[0].filename} to ${bFiles[0].filename}`,
                aFiles[0].code,
                bFiles[0].code,
            ),
        )
        return files
    }

    for (const aFile of aFiles) {
        const bFile = bFiles.find(
            (candidate) => candidate.filename === aFile.filename,
        )
        if (bFile) {
            files.push(
                compareSourceCode(aFile.filename, aFile.code, bFile.code),
            )
        } else {
            files.push({
                filename: aFile.filename,
                aCode: aFile.code,
                result: 'removed',
            })
        }
    }

    for (const bFile of bFiles) {
        const aFile = aFiles.find(
            (candidate) => candidate.filename === bFile.filename,
        )
        if (!aFile) {
            files.push({
                filename: bFile.filename,
                bCode: bFile.code,
                result: 'added',
            })
        }
    }

    return files.sort((a, b) => a.filename.localeCompare(b.filename))
}
