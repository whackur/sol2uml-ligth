import type { EtherscanParser } from '../explorer/etherscan-parser.js'
import type { ExplorerSourceFile } from '../explorer/source-code-types.js'
import type { CompareContracts, DiffOptions } from './types.js'
import {
    compareSourceCode,
    compareVerifiedSourceFiles,
} from './source-comparison.js'

const selectSourceFile = (
    files: ExplorerSourceFile[],
    filename: string,
    contractSide: 'A' | 'B',
    address: string,
): ExplorerSourceFile => {
    const matches = files.filter((file) => file.filename === filename)
    if (matches.length === 0) {
        throw new Error(
            `Could not find source file "${filename}" in contract ${contractSide} at address ${address}.`,
        )
    }
    if (matches.length > 1) {
        throw new Error(
            `Found ${matches.length} source files with exact path "${filename}" in contract ${contractSide} at address ${address}; expected exactly one.`,
        )
    }
    return matches[0]
}

export const diffVerifiedContracts = async (
    addressA: string,
    addressB: string,
    etherscanParserA: EtherscanParser,
    etherscanParserB: EtherscanParser,
    options: DiffOptions,
): Promise<CompareContracts> => {
    const { files: aFiles, contractName: contractNameA } =
        await etherscanParserA.getSourceCode(addressA)
    const { files: bFiles, contractName: contractNameB } =
        await etherscanParserB.getSourceCode(addressB)

    if (options.aFile) {
        const bFilename = options.bFile || options.aFile
        const aFile = selectSourceFile(aFiles, options.aFile, 'A', addressA)
        const bFile = selectSourceFile(bFiles, bFilename, 'B', addressB)

        return {
            files: [compareSourceCode(options.aFile, aFile.code, bFile.code)],
            contractNameA,
            contractNameB,
        }
    }

    return {
        files: compareVerifiedSourceFiles(aFiles, bFiles),
        contractNameA,
        contractNameB,
    }
}
