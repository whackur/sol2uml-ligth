import { Option } from 'commander'
import type { Command } from 'commander'
import {
    addDynamicVariables,
    convertClasses2StorageSections,
    optionStorageVariables,
} from '../../converterClasses2Storage.js'
import { convertStorages2Dot } from '../../diagram/storageToDot.js'
import { parserUmlClasses } from '../../parsing/parserGeneral.js'
import { addSlotValues } from '../../slotValues.js'
import { isAddress } from '../../utils/regEx.js'
import { writeOutputFiles } from '../../output/writer.js'
import { getBlock } from '../../network/block.js'
import {
    validateAddress,
    validateNames,
    validateSlotNames,
    validateTypes,
} from '../optionValidators.js'
import { argumentText } from '../argumentText.js'
import { combineCommandOptions } from '../combinedOptions.js'

export const registerStorageCommand = (program: Command): void => {
    program
        .command('storage')
        .usage('[options] <fileFolderAddress>')
        .description(
            `Visually display a contract's storage slots.

WARNING: sol2uml-light does not use the Solidity compiler so may differ with solc. A known example is fixed-sized arrays declared with an expression will fail to be sized.\n`,
        )
        .argument('fileFolderAddress', argumentText)
        .option(
            '-c, --contract <name>',
            'Contract name in the local Solidity files. Not needed when using an address as the first argument as the contract name can be derived from Etherscan.',
        )
        .option(
            '-cf, --contractFile <filename>',
            'Filename the contract is located in. This can include the relative path to the desired file.',
        )
        .option(
            '-d, --data',
            'Gets the values in the storage slots from an Ethereum node.',
            false,
        )
        .option(
            '-s, --storage <address>',
            'The address of the contract with the storage values. This will be different from the contract with the code if a proxy contract is used. This is not needed if `fileFolderAddress` is an address and the contract is not proxied.',
            validateAddress,
        )
        .addOption(
            new Option(
                '-u, --url <url>',
                'URL of the Ethereum node to get storage values if the `data` option is used.',
            )
                .env('NODE_URL')
                .default('http://localhost:8545'),
        )
        .option(
            '-bn, --block <number>',
            'Block number to get the contract storage values from.',
            'latest',
        )
        .option(
            '-sn, --slotNames <names>',
            'Comma-separated list of slot names when accessed by assembly. The names can be a string, which will be hashed to a slot, or a 32 bytes hexadecimal string with a 0x prefix.',
            validateSlotNames,
        )
        .option(
            '-st, --slotTypes <types>',
            'Comma-separated list of types for the slots listed in the `slotNames` option. eg address,uint256,bool. If all types are the same, a single type can be used. eg address',
            validateTypes,
            ['bytes32'],
        )
        .option(
            '-a, --array <number>',
            'Number of slots to display at the start and end of arrays.',
            '2',
        )
        .option(
            '-hx, --hideExpand <variables>',
            "Comma-separated list of storage variables to not expand. That's arrays, structs, strings or bytes.",
            validateNames,
        )
        .option('-hv, --hideValues', 'Hide storage slot value column.', false)
        .action(async (fileFolderAddress, options, command) => {
            try {
                const combinedOptions = combineCommandOptions(command, options)

                if (
                    !isAddress(fileFolderAddress) &&
                    !combinedOptions.contract
                ) {
                    throw Error(
                        `Must use the \`-c, --contract <name>\` option to specify the contract to draw the storage diagram for when sourcing from local files.\nThis option is not needed when sourcing from a blockchain explorer with a contract address.`,
                    )
                }

                let { umlClasses, contractName } = await parserUmlClasses(
                    fileFolderAddress,
                    combinedOptions,
                )

                contractName = combinedOptions.contract || contractName
                const arrayItems = parseInt(combinedOptions.array)
                const storageSections = convertClasses2StorageSections(
                    contractName,
                    umlClasses,
                    arrayItems,
                    combinedOptions.contractFile,
                    options.hideExpand,
                )
                const optionVariables = optionStorageVariables(
                    contractName,
                    options.slotNames,
                    options.slotTypes,
                )
                storageSections[0].variables = [
                    ...storageSections[0].variables,
                    ...optionVariables,
                ]

                if (isAddress(fileFolderAddress)) {
                    storageSections[0].address = fileFolderAddress
                }

                if (combinedOptions.data) {
                    let storageAddress = combinedOptions.storage
                    if (storageAddress) {
                        if (!isAddress(storageAddress)) {
                            throw Error(
                                `Invalid address to get storage data from "${storageAddress}"`,
                            )
                        }
                    } else {
                        if (!isAddress(fileFolderAddress)) {
                            throw Error(
                                `Can not get storage slot values if first param is not an address and the \`--storage\` option is not used.`,
                            )
                        }
                        storageAddress = fileFolderAddress
                    }

                    const block = await getBlock({
                        block: combinedOptions.block,
                        url: combinedOptions.url,
                        network: combinedOptions.network,
                    })

                    for (const storageSection of storageSections) {
                        await addSlotValues(
                            combinedOptions.url,
                            storageAddress,
                            storageSection,
                            arrayItems,
                            block,
                        )
                        await addDynamicVariables(
                            storageSection,
                            storageSections,
                            combinedOptions.url,
                            storageAddress,
                            arrayItems,
                            block,
                        )
                    }
                }

                const dotString = convertStorages2Dot(storageSections, {
                    data: combinedOptions.data,
                    backColor: combinedOptions.backColor,
                    shapeColor: combinedOptions.shapeColor,
                    fillColor: combinedOptions.fillColor,
                    textColor: combinedOptions.textColor,
                    hideValues: combinedOptions.hideValues,
                })

                await writeOutputFiles(
                    dotString,
                    contractName || 'storageDiagram',
                    combinedOptions.outputFormat,
                    combinedOptions.outputFileName,
                )
            } catch (err) {
                console.error(err)
                process.exit(2)
            }
        })
}
