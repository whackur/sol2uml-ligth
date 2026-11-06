import type { Command, OptionValues } from 'commander'

export const combineCommandOptions = (
    command: Command,
    options: OptionValues,
): OptionValues => ({
    ...command.parent.opts(),
    ...options,
})
