import { Option } from 'commander'
import type { Command } from 'commander'
import { convertUmlClasses2Dot } from '../../diagram/classesToDot.js'
import {
    filterHiddenClasses,
    classesConnectedToBaseContracts,
} from '../../classes/filter.js'
import { parserUmlClasses } from '../../parsing/parserGeneral.js'
import { squashUmlClasses } from '../../classes/squash.js'
import { writeOutputFiles } from '../../output/writer.js'
import { validateNames } from '../optionValidators.js'
import { argumentText } from '../argumentText.js'
import { combineCommandOptions } from '../combinedOptions.js'

const debug = require('debug')('sol2uml-light')

export const registerClassCommand = (program: Command): void => {
    program
        .command('class', { isDefault: true })
        .usage('[options] <fileFolderAddress>')
        .description('Generates a UML class diagram from Solidity source code.')
        .argument('fileFolderAddress', argumentText)
        .option(
            '-b, --baseContractNames <names>',
            'only output contracts connected to these comma-separated base contract names',
            validateNames,
        )
        .addOption(
            new Option(
                '-d, --depth <value>',
                'depth of connected classes to the base contracts. 1 will only show directly connected contracts, interfaces, libraries, structs and enums.',
            ).default('100', 'all'),
        )
        .option(
            '-c, --clusterFolders',
            'cluster contracts into source folders',
            false,
        )
        .option(
            '-hv, --hideVariables',
            'hide variables from contracts, interfaces, structs and enums',
            false,
        )
        .option(
            '-hf, --hideFunctions',
            'hide functions from contracts, interfaces and libraries',
            false,
        )
        .option(
            '-hy, --hideTypes',
            'hide types of variables, function arguments and return types',
            false,
        )
        .option(
            '-hp, --hidePrivates',
            'hide private and internal attributes and operators',
            false,
        )
        .option(
            '-hm, --hideModifiers',
            'hide modifier functions from contracts',
            false,
        )
        .option(
            '-ht, --hideEvents',
            'hide events from contracts, interfaces and libraries',
            false,
        )
        .option('-hc, --hideConstants', 'hide file level constants', false)
        .option('-hx, --hideContracts', 'hide contracts', false)
        .option('-he, --hideEnums', 'hide enum types', false)
        .option('-hs, --hideStructs', 'hide data structures', false)
        .option('-hl, --hideLibraries', 'hide libraries', false)
        .option('-hi, --hideInterfaces', 'hide interfaces', false)
        .option('-ha, --hideAbstracts', 'hide abstract contracts', false)
        .option(
            '-hn, --hideFilename',
            'hide relative path and file name',
            false,
        )
        .option(
            '-hd, --hideDepFunctions',
            'hide function names on dependency arrows',
            false,
        )
        .option(
            '-s, --squash',
            'squash inherited contracts to the base contract(s)',
            false,
        )
        .option(
            '-hsc, --hideSourceContract',
            'hide the source contract when using squash',
            false,
        )
        .action(async (fileFolderAddress, options, command) => {
            try {
                const combinedOptions = combineCommandOptions(command, options)

                let { umlClasses, contractName } = await parserUmlClasses(
                    fileFolderAddress,
                    combinedOptions,
                )

                if (
                    options.squash &&
                    !options.baseContractNames &&
                    !contractName
                ) {
                    throw Error(
                        'Must specify base contract(s) when using the squash option against local Solidity files.',
                    )
                }
                if (options.squash && options.hideContracts) {
                    throw Error(
                        'Can not hide contracts when squashing contracts.',
                    )
                }

                if (options.baseContractNames) {
                    contractName = options.baseContractNames[0]
                }

                let filteredUmlClasses = filterHiddenClasses(
                    umlClasses,
                    options,
                )

                if (options.squash) {
                    filteredUmlClasses = squashUmlClasses(
                        filteredUmlClasses,
                        options.baseContractNames || [contractName],
                    )
                }

                if (options.baseContractNames || options.squash) {
                    filteredUmlClasses = classesConnectedToBaseContracts(
                        filteredUmlClasses,
                        options.baseContractNames || [contractName],
                        options.depth,
                    )
                }

                const dotString = convertUmlClasses2Dot(
                    filteredUmlClasses,
                    combinedOptions.clusterFolders,
                    combinedOptions,
                )

                await writeOutputFiles(
                    dotString,
                    contractName || 'classDiagram',
                    combinedOptions.outputFormat,
                    combinedOptions.outputFileName,
                )

                debug(`Finished generating UML`)
            } catch (err) {
                console.error(err)
                process.exit(2)
            }
        })
}
