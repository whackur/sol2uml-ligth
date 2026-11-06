import { Command } from 'commander'
import {
    registerClassCommand,
    registerDiffCommand,
    registerFlattenCommand,
    registerStorageCommand,
} from './commands/index.js'
import { configureProgramOptions } from './programOptions.js'

const debugControl = require('debug')
const debug = require('debug')('sol2uml-light')

export const runCli = async (argv: string[] = process.argv): Promise<void> => {
    const program = new Command()
    program.name('sol2uml-light')
    configureProgramOptions(program)
    registerClassCommand(program)
    registerStorageCommand(program)
    registerFlattenCommand(program)
    registerDiffCommand(program)

    program.on('option:verbose', () => {
        debugControl.enable('sol2uml-light,axios')
        debug('verbose on')
    })

    await program.parseAsync(argv)
}
