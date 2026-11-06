import type { ASTNode } from '@solidity-parser/parser/dist/src/ast-types'
import type { Remapping } from './imports/remappingTypes.js'
import type { UmlClass } from './umlClass.js'
import { convertAST2UmlClasses as convertSourceUnit } from './ast/sourceUnit.js'

export { renameFile } from './imports/remappings.js'

export function convertAST2UmlClasses(
    node: ASTNode,
    relativePath: string,
    remappings: Remapping[],
    filesystem: boolean = false,
    remappingsBase?: string,
): UmlClass[] {
    return convertSourceUnit(
        node,
        relativePath,
        remappings,
        filesystem,
        remappingsBase,
    )
}
