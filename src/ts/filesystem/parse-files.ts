import { relative } from 'path'
import type { Remapping } from '../imports/remappingTypes.js'
import { convertAST2UmlClasses } from '../converterAST2Classes.js'
import type { UmlClass } from '../umlClass.js'
import { findFoundryTomlRemappings } from './foundry-config.js'
import { canonicalPath } from './canonical-path.js'
import { getSolidityFilesFromFolderOrFiles } from './solidity-file-discovery.js'
import { parseSolidityFile } from './solidity-source-reader.js'

export const parseUmlClassesFromFiles = async (
    filesOrFolders: readonly string[],
    ignoreFilesOrFolders: readonly string[],
    subfolders: number = -1,
): Promise<UmlClass[]> => {
    const files = await getSolidityFilesFromFolderOrFiles(
        filesOrFolders,
        ignoreFilesOrFolders,
        subfolders,
    )

    let remappings: Remapping[] = []
    let remappingsBase: string | undefined
    const foundryResult = findFoundryTomlRemappings(
        filesOrFolders[0] || process.cwd(),
    )
    if (foundryResult) {
        remappings = foundryResult.remappings
        remappingsBase = foundryResult.base
    }

    let umlClasses: UmlClass[] = []
    for (const file of files) {
        // Preserve ID allocation order across concurrent parser calls.
        const node = await parseSolidityFile(file)
        const relativePath = relative(process.cwd(), file)
        const newUmlClasses = convertAST2UmlClasses(
            node,
            relativePath,
            remappings,
            true,
            remappingsBase,
        )
        const absolutePath = canonicalPath(file)
        newUmlClasses.forEach((umlClass) => {
            umlClass.absolutePath = absolutePath
        })
        const imports = newUmlClasses[0]?.imports
        imports?.forEach((importLink) => {
            importLink.absolutePath = canonicalPath(importLink.absolutePath)
        })
        umlClasses = umlClasses.concat(newUmlClasses)
    }
    return umlClasses
}
