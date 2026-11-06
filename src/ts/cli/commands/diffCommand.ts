import { Option } from 'commander'
import type { Command } from 'commander'
import {
    compareVerified2Local,
    compareFlattenContracts,
    compareVerifiedContracts,
} from '../../diffContracts.js'
import { EtherscanParser, networks } from '../../parserEtherscan.js'
import { isAddress } from '../../utils/regEx.js'
import { validateAddress, validateLineBuffer } from '../optionValidators.js'
import { combineCommandOptions } from '../combinedOptions.js'

const clc = require('cli-color')
const debug = require('debug')('sol2uml-light')

export const registerDiffCommand = (program: Command): void => {
    program
        .command('diff')
        .usage('[options] <addressA> <addressB or comma-separated folders>')
        .description(
            `Compare verified contract code on Etherscan-like explorers to another verified contract, a local file or multiple local files.

The results show the comparison of contract A to B.
The ${clc.green(
                'green',
            )} sections are additions to contract B that are not in contract A.
The ${clc.red(
                'red',
            )} sections are removals from contract A that are not in contract B.
The line numbers are from contract B. There are no line numbers for the red sections as they are not in contract B.\n`,
        )
        .argument(
            '<addressA>',
            'Contract address in hexadecimal format with a 0x prefix of the first contract',
            validateAddress,
        )
        .argument(
            '<fileFoldersAddress>',
            `Location of the contract source code to compare against. Can be a filename, comma-separated list of local folders or a contract address. Examples:
  "flat.sol" will compare against a local file called "flat.sol". This must be used when address A's verified source code is a single, flat file.
  ".,node_modules" will compare against local files under the current working folder and the node_modules folder. This is used when address A's verified source code is multiple files.
  0x1091588Cc431275F99DC5Df311fd8E1Ab81c89F3 will compare against the verified source code from Etherscan.`,
        )
        .option(
            '-s, --summary',
            'Only show a summary of the file differences',
            false,
        )
        .option(
            '-af --aFile <value>',
            'Limit code compare to contract A source file with the full path and extension as displayed in the file summary (default: compares all source files)',
        )
        .option(
            '-bf --bFile <value>',
            'Contract B source file with the full path and extension as displayed in the file summary. Used if aFile is specified and the source file has been renamed (default: aFile if specified)',
        )
        .addOption(
            new Option(
                '-bn, --bNetwork <network>',
                'Ethereum network which maps to a blockchain explorer for contract B if on a different blockchain to contract A. Contract A uses the `network` option (default: value of `network` option)',
            ).choices(networks),
        )
        .option(
            '--flatten',
            'Flatten into a single file before comparing. Only works when comparing two verified contracts, not to local files',
            false,
        )
        .option(
            '--saveFiles',
            'Save the flattened contract code to the filesystem when using the `flatten` option. The file names will be the contract address with a .sol extension',
            false,
        )
        .option(
            '-l, --lineBuffer <value>',
            'Minimum number of lines before and after changes (default: 4)',
            validateLineBuffer,
        )
        .action(async (addressA, fileFoldersAddress, options, command) => {
            try {
                debug(`About to compare ${addressA} to ${fileFoldersAddress}`)

                const combinedOptions = combineCommandOptions(command, options)
                const diffOptions = {
                    ...combinedOptions,
                    network: combinedOptions.network,
                    lineBuffer: combinedOptions.lineBuffer,
                }

                const aEtherscanParser = new EtherscanParser(
                    combinedOptions.apiKey,
                    combinedOptions.network,
                    combinedOptions.explorerUrl,
                )

                if (isAddress(fileFoldersAddress)) {
                    const addressB = fileFoldersAddress
                    const bEtherscanParser = new EtherscanParser(
                        combinedOptions.apiKey,
                        combinedOptions.bNetwork || combinedOptions.network,
                        combinedOptions.explorerUrl,
                    )
                    if (options.flatten) {
                        await compareFlattenContracts(
                            addressA,
                            addressB,
                            aEtherscanParser,
                            bEtherscanParser,
                            diffOptions,
                        )
                    } else {
                        await compareVerifiedContracts(
                            addressA,
                            aEtherscanParser,
                            addressB,
                            bEtherscanParser,
                            diffOptions,
                        )
                    }
                } else {
                    const localFolders: string[] = fileFoldersAddress.split(',')
                    await compareVerified2Local(
                        addressA,
                        aEtherscanParser,
                        localFolders,
                        diffOptions,
                    )
                }
            } catch (err) {
                console.error(err)
                process.exit(2)
            }
        })
}
