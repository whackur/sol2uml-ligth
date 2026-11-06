import type { EtherscanParser } from '../explorer/etherscan-parser.js'
import { writeSourceCode } from '../writerFiles.js'
import { diffCode } from './code-diff-output.js'
import type { DiffOptions } from './types.js'

export const compareFlattenContracts = async (
    addressA: string,
    addressB: string,
    aEtherscanParser: EtherscanParser,
    bEtherscanParser: EtherscanParser,
    options: DiffOptions,
): Promise<{ contractNameA: string; contractNameB: string }> => {
    const { solidityCode: codeA, contractName: contractNameA } =
        await aEtherscanParser.getSolidityCode(addressA, options.aFile)
    const { solidityCode: codeB, contractName: contractNameB } =
        await bEtherscanParser.getSolidityCode(
            addressB,
            options.bFile || options.aFile,
        )

    diffCode(codeA, codeB, options.lineBuffer)
    if (options.saveFiles) {
        await writeSourceCode(codeA, addressA)
        await writeSourceCode(codeB, addressB)
    }

    if (options.bFile || options.aFile) {
        console.log(
            `Compared the "${options.aFile}" file with the "${contractNameA}" contract with address ${addressA} on ${options.network}`,
        )
        console.log(
            `to the "${
                options.bFile || options.aFile
            }" file for the "${contractNameB}" contract with address ${addressB} on ${
                options.bNetwork || options.network
            }\n`,
        )
    } else {
        console.log(
            `Compared the flattened "${contractNameA}" contract with address ${addressA} on ${options.network}`,
        )
        console.log(
            `to the flattened "${contractNameB}" contract with address ${addressB} on ${
                options.bNetwork || options.network
            }\n`,
        )
    }

    return { contractNameA, contractNameB }
}
