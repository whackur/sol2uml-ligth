import { lstatSync, readFileSync } from 'fs'
import { dirname, join, resolve } from 'path'

import { parseFoundryTomlRemappings } from './foundry-remappings.js'
import type { Remapping } from '../imports/remappingTypes.js'

const debug = require('debug')('sol2uml-light')

export const findFoundryTomlRemappings = (
    startPath: string,
): { remappings: Remapping[]; base: string } | null => {
    let dir: string
    try {
        dir = lstatSync(startPath).isDirectory()
            ? resolve(startPath)
            : dirname(resolve(startPath))
    } catch {
        dir = resolve(startPath)
    }
    while (true) {
        const foundryTomlPath = join(dir, 'foundry.toml')
        try {
            const content = readFileSync(foundryTomlPath, 'utf8')
            const remappings = parseFoundryTomlRemappings(content)
            if (remappings.length > 0) {
                debug(
                    `Found ${remappings.length} Foundry remappings in ${foundryTomlPath}`,
                )
                return { remappings, base: dir }
            }
        } catch {
            // Keep searching parent directories when a config cannot be read.
        }
        const parent = dirname(dir)
        if (parent === dir) break
        dir = parent
    }
    return null
}
