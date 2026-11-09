import type { Command } from 'commander'
import { EtherscanParser } from '../../parserEtherscan.js'
import { writeSourceCode } from '../../output/writer.js'
import { combineCommandOptions } from '../combinedOptions.js'
import { validateAddress } from '../optionValidators.js'

const debug = require('debug')('sol2uml-light')

export const registerFlattenCommand = (program: Command): void => {
    program
        .command('flatten')
        .usage('<contractAddress>')
        .description(
            `Merges verified source files for a contract from a Blockchain explorer into one local Solidity file.

In order for the merged code to compile, the following is done:
1. pragma solidity is set using the compiler of the verified contract.
2. All pragma solidity lines in the source files are commented out.
3. File imports are commented out.
4. "SPDX-License-Identifier" is renamed to "SPDX--License-Identifier".
5. Contract dependencies are analysed so the files are merged in an order that will compile.\n`,
        )
        .argument(
            '<contractAddress>',
            'Contract address in hexadecimal format with a 0x prefix.',
            validateAddress,
        )
        .action(async (contractAddress, options, command) => {
            try {
                debug(`About to flatten ${contractAddress}`)

                const combinedOptions = combineCommandOptions(command, options)

                const etherscanParser = new EtherscanParser(
                    combinedOptions.apiKey,
                    combinedOptions.network,
                    combinedOptions.explorerUrl,
                )

                const { solidityCode, contractName } =
                    await etherscanParser.getSolidityCode(contractAddress)

                const outputFilename =
                    combinedOptions.outputFileName || contractName
                await writeSourceCode(solidityCode, outputFilename)
            } catch (err) {
                console.error(err)
                process.exit(2)
            }
        })
}
