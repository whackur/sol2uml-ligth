import { parseRemapping } from '../imports/remappings.js'
import type { Remapping } from '../imports/remappingTypes.js'

export const parseFoundryTomlRemappings = (content: string): Remapping[] => {
    const match = content.match(/^remappings\s*=\s*\[([^\]]*)\]/ms)
    if (!match) return []
    const remappings: Remapping[] = []
    for (const line of match[1].split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const stringMatch = trimmed.match(/^"([^"]+)"/)
        if (stringMatch) {
            try {
                remappings.push(parseRemapping(stringMatch[1]))
            } catch {
                // Invalid entries are ignored to match Foundry's partial config handling.
            }
        }
    }
    return remappings
}
