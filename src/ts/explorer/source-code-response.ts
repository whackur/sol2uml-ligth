import path from 'path'

import type { Remapping } from '../imports/remappingTypes.js'
import { parseRemappings } from '../imports/remappings.js'
import type {
    ExplorerContractResult,
    ExplorerResponseData,
    ExplorerSourceCode,
    ExplorerSourceCodeObject,
} from './source-code-types.js'

export const decodeSourceCodeResponse = (
    data: unknown,
    contractAddress: string,
    filename?: string,
): ExplorerSourceCode => {
    const description = `get verified source code for address ${contractAddress} from Etherscan API.`
    const responseData = data as ExplorerResponseData | null
    if (!Array.isArray(responseData?.result)) {
        throw new Error(
            `Failed to ${description}. No result array in HTTP data: ${JSON.stringify(
                responseData,
            )}`,
        )
    }

    const contractResults = responseData.result as ExplorerContractResult[]
    // Stays undefined for plain single-file sources; kept as-is
    let remappings!: Remapping[]
    const results = contractResults.map((result) => {
        if (!result.SourceCode) {
            throw new Error(
                `Failed to ${description}. Most likely the contract has not been verified on Etherscan.`,
            )
        }

        if ((result.SourceCode as { [index: number]: unknown })[0] === '{') {
            try {
                let parableResultString = result.SourceCode as string
                if ((result.SourceCode as string)[1] === '{') {
                    // Some explorer responses wrap the JSON source object in an extra brace pair.
                    parableResultString = (result.SourceCode as string).slice(
                        1,
                        -1,
                    )
                }
                const sourceCodeObject = JSON.parse(
                    parableResultString,
                ) as ExplorerSourceCodeObject
                remappings = parseRemappings(
                    sourceCodeObject.settings?.remappings,
                )
                // The API sends file entries either in `sources` or at the object root.
                const sourceFiles = (
                    sourceCodeObject.sources
                        ? Object.entries(sourceCodeObject.sources)
                        : Object.entries(sourceCodeObject)
                ) as [string, { content: string }][]
                return sourceFiles.map(
                    ([sourceFilename, code]: [
                        string,
                        { content: string },
                    ]) => ({
                        code: code.content,
                        filename: sourceFilename,
                    }),
                )
            } catch (err) {
                throw new Error(
                    `Failed to parse Solidity source code from Etherscan's SourceCode. ${result.SourceCode}`,
                    { cause: err },
                )
            }
        }

        const sourceCodeObject = result.SourceCode as ExplorerSourceCodeObject
        if (sourceCodeObject?.sources) {
            const sourceFiles = Object.values(sourceCodeObject.sources) as [
                string,
                { content: string },
            ][]
            remappings = parseRemappings(sourceCodeObject.settings?.remappings)
            return sourceFiles.map(
                ([sourceFilename, code]: [string, { content: string }]) => ({
                    code: code.content,
                    filename: sourceFilename,
                }),
            )
        }

        return {
            code: result.SourceCode as string,
            filename: contractAddress,
        }
    })

    let files = results.flat(1)
    const filenameWithExt = filename + '.sol'
    if (filename) {
        files = files.filter(
            (result: { filename: string }) =>
                path.parse(result.filename).base == filenameWithExt,
        )
        if (!files?.length) {
            throw new Error(
                `Failed to find source file "${filename}" for contract ${contractAddress}`,
            )
        }
    }

    return {
        files,
        contractName: contractResults[0].ContractName,
        compilerVersion: contractResults[0].CompilerVersion,
        remappings,
    }
}
