import type { Remapping } from './remappingTypes.js'

const debug = require('debug')('sol2uml-light')

/** Parses remappings returned in Etherscan's source metadata. */
export const parseRemappings = (
    rawMappings: string[] | undefined,
): Remapping[] => {
    if (!rawMappings) return []
    return rawMappings.map((mapping: string) => parseRemapping(mapping))
}

/** Maps an import prefix to its replacement, such as `@openzeppelin/` to `lib/openzeppelin-contracts/`. */
export const parseRemapping = (mapping: string): Remapping => {
    const equalIndex = mapping.indexOf('=')
    const from = mapping.slice(0, equalIndex)
    const to = mapping.slice(equalIndex + 1)
    return {
        from: new RegExp('^' + from),
        to,
    }
}

/** Applies the first matching remapping, so rule order is significant. */
export const renameFile = (fileName: string, mappings: Remapping[]): string => {
    let renamedFile = fileName
    for (const mapping of mappings) {
        if (renamedFile.match(mapping.from)) {
            const beforeFileName = renamedFile
            renamedFile = renamedFile.replace(mapping.from, mapping.to)
            debug(`remapping ${beforeFileName} to ${renamedFile}`)
            break
        }
    }
    return renamedFile
}
