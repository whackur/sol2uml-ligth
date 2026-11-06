import { Option } from 'commander'
import type { Command } from 'commander'
import { networks } from '../parserEtherscan.js'
import { validateNames } from './optionValidators.js'
import { getPackageVersion } from './packageVersion.js'

export const configureProgramOptions = (program: Command): void => {
    program
        .usage('[command] <options>')
        .description(
            `Generate UML class or storage diagrams from local Solidity code or verified Solidity code on Etherscan-like explorers.
Can also flatten or compare verified source files on Etherscan-like explorers.`,
        )
        .addOption(
            new Option(
                '-sf, --subfolders <value>',
                'number of subfolders that will be recursively searched for Solidity files.',
            ).default('-1', 'all'),
        )
        .addOption(
            new Option('-f, --outputFormat <value>', 'output file format.')
                .choices(['svg', 'png', 'dot', 'all'])
                .default('svg'),
        )
        .option('-o, --outputFileName <value>', 'output file name')
        .option(
            '-i, --ignoreFilesOrFolders <names>',
            'comma-separated list of files or folders to ignore',
            validateNames,
        )
        .addOption(
            new Option(
                '-n, --network <network>',
                'Name or chain id of the blockchain explorer. A name like `ethereum` or `base` will map to a chain id, eg 1 or 8453. Alternatively, use an integer of the chain id. Supported names: ' +
                    networks.join(', '),
            )
                .default('ethereum')
                .env('ETH_NETWORK'),
        )
        .addOption(
            new Option(
                '-e, --explorerUrl <url>',
                'Override the `network` option with a custom blockchain explorer API URL. eg Polygon Amoy testnet https://api-amoy.polygonscan.com/api',
            ).env('EXPLORER_URL'),
        )
        .addOption(
            new Option(
                '-k, --apiKey <key>',
                'Blockchain explorer API key.',
            ).env('SCAN_API_KEY'),
        )
        .option(
            '-bc, --backColor <color>',
            'Canvas background color. "none" will use a transparent canvas.',
            'white',
        )
        .option(
            '-sc, --shapeColor <color>',
            'Basic drawing color for graphics, not text',
            'black',
        )
        .option(
            '-fc, --fillColor <color>',
            'Color used to fill the background of a node',
            'gray95',
        )
        .option('-tc, --textColor <color>', 'Color used for text', 'black')
        .option('-v, --verbose', 'run with debugging statements', false)
        .version(getPackageVersion())
}
