import type { EtherscanParser } from '../explorer/etherscan-parser.js'
import { diffVerifiedContracts } from './verified-contract-diff.js'
import { diffVerified2Local } from './local-contract-diff.js'
import { displayFileDiffs, displayFileDiffSummary } from './file-diff-output.js'
import type { DiffOptions } from './types.js'

export const compareVerifiedContracts = async (
    addressA: string,
    aEtherscanParser: EtherscanParser,
    addressB: string,
    bEtherscanParser: EtherscanParser,
    options: DiffOptions,
): Promise<void> => {
    const { contractNameA, contractNameB, files } = await diffVerifiedContracts(
        addressA,
        addressB,
        aEtherscanParser,
        bEtherscanParser,
        options,
    )
    if (!options.summary) displayFileDiffs(files, options)

    const aFileDesc = options.aFile ? `"${options.aFile}" file for the ` : ''
    const bFileDesc = options.aFile
        ? `"${options.bFile || options.aFile}" file for the `
        : ''
    console.log(
        `Compared the ${aFileDesc}"${contractNameA}" contract with address ${addressA} on ${options.network}`,
    )
    console.log(
        `to the ${bFileDesc}"${contractNameB}" contract with address ${addressB} on ${
            options.bNetwork || options.network
        }\n`,
    )
    displayFileDiffSummary(files)
}

export const compareVerified2Local = async (
    addressA: string,
    aEtherscanParser: EtherscanParser,
    fileOrBaseFolders: string[],
    options: DiffOptions,
): Promise<void> => {
    const { contractNameA, files, local } = await diffVerified2Local(
        addressA,
        aEtherscanParser,
        fileOrBaseFolders,
    )
    if (!options.summary) displayFileDiffs(files, options)

    const aFileDesc = options.aFile ? `"${options.aFile}" file with the ` : ''
    console.log(
        `Compared the ${aFileDesc}"${contractNameA}" contract with address ${addressA} on ${options.network}`,
    )
    if (local) {
        console.log(`to local file "${fileOrBaseFolders}"\n`)
    } else {
        console.log(`to local files under folders "${fileOrBaseFolders}"\n`)
    }
    displayFileDiffSummary(files)
}
