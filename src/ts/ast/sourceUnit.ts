import type { ASTNode } from '@solidity-parser/parser/dist/src/ast-types'
import * as path from 'path'
import { ClassStereotype, UmlClass } from '../umlClass.js'
import type { Import } from '../umlClass.js'
import { resolveImport } from '../imports/importResolver.js'
import type { Remapping } from '../imports/remappingTypes.js'
import {
    parseEnumDefinition,
    parseStructDefinition,
    parseContractDefinition,
} from './declarations.js'
import { parseTypeName } from './typeParsing.js'

const debug = require('debug')('sol2uml-light')

let umlClasses: UmlClass[]

export function convertAST2UmlClasses(
    node: ASTNode,
    relativePath: string,
    remappings: Remapping[],
    filesystem: boolean = false,
    remappingsBase?: string,
): UmlClass[] {
    const imports: Import[] = []
    umlClasses = []

    if (node.type === 'SourceUnit') {
        node.children.forEach((childNode) => {
            if (childNode.type === 'ContractDefinition') {
                const umlClass = new UmlClass({
                    name: childNode.name,
                    absolutePath: filesystem
                        ? path.resolve(relativePath)
                        : relativePath,
                    relativePath,
                })
                umlClasses.push(umlClass)
                parseContractDefinition(childNode, umlClass, umlClasses)
                debug(`Added contract ${childNode.name}`)
            } else if (childNode.type === 'StructDefinition') {
                debug(`Adding file level struct ${childNode.name}`)
                const umlClass = new UmlClass({
                    name: childNode.name,
                    stereotype: ClassStereotype.Struct,
                    absolutePath: filesystem
                        ? path.resolve(relativePath)
                        : relativePath,
                    relativePath,
                })
                parseStructDefinition(childNode, umlClass)
                debug(`Added struct ${umlClass.name}`)
                umlClasses.push(umlClass)
            } else if (childNode.type === 'EnumDefinition') {
                debug(`Adding file level enum ${childNode.name}`)
                const umlClass = new UmlClass({
                    name: childNode.name,
                    stereotype: ClassStereotype.Enum,
                    absolutePath: filesystem
                        ? path.resolve(relativePath)
                        : relativePath,
                    relativePath,
                })
                debug(`Added enum ${umlClass.name}`)
                parseEnumDefinition(childNode, umlClass)
                umlClasses.push(umlClass)
            } else if (childNode.type === 'ImportDirective') {
                const imported = resolveImport(
                    childNode,
                    relativePath,
                    remappings,
                    filesystem,
                    remappingsBase,
                )
                if (imported) {
                    imports.push(imported)
                }
            } else if (childNode.type === 'FileLevelConstant') {
                debug(`Adding file level constant ${childNode.name}`)
                const [type, attributeType] = parseTypeName(childNode.typeName)
                const umlClass = new UmlClass({
                    name: childNode.name,
                    stereotype: ClassStereotype.Constant,
                    absolutePath: filesystem
                        ? path.resolve(relativePath)
                        : relativePath,
                    relativePath,
                    attributes: [
                        {
                            name: childNode.name,
                            type,
                            attributeType,
                        },
                    ],
                })
                if (childNode?.initialValue?.type === 'NumberLiteral') {
                    umlClass.constants.push({
                        name: childNode.name,
                        value: parseInt(childNode.initialValue.number),
                    })
                }
                // TODO handle expressions. eg N_COINS * 2
                umlClasses.push(umlClass)
            } else if (childNode.type !== 'PragmaDirective') {
                debug(
                    `node type "${childNode.type}" not parsed in ${relativePath}`,
                )
            }
        })
    } else {
        throw new Error(`AST node not of type SourceUnit`)
    }

    if (umlClasses.length > 0) {
        umlClasses.forEach((umlClass) => {
            umlClass.imports = imports
        })
    } else {
        const importUmlClass = new UmlClass({
            name: 'Import',
            stereotype: ClassStereotype.Import,
            absolutePath: filesystem
                ? path.resolve(relativePath)
                : relativePath,
            relativePath,
        })
        importUmlClass.imports = imports
        umlClasses = [importUmlClass]
    }

    return umlClasses
}
