import type {
    ASTNode,
    ContractDefinition,
    EnumDefinition,
    EnumValue,
    StateVariableDeclarationVariable,
    StructDefinition,
    UsingForDeclaration,
    VariableDeclaration,
} from '@solidity-parser/parser/dist/src/ast-types'
import {
    ClassStereotype,
    OperatorStereotype,
    ReferenceType,
    UmlClass,
} from '../umlClass.js'
import {
    isEnumDefinition,
    isEventDefinition,
    isFunctionDefinition,
    isModifierDefinition,
    isStateVariableDeclaration,
    isStructDefinition,
    isUsingForDeclaration,
} from './typeGuards.js'
import { addAssociations } from './associationParsing.js'
import {
    parseParameters,
    parseTypeName,
    parseVisibility,
    parseContractKind,
} from './typeParsing.js'

export function parseStructDefinition(
    node: StructDefinition,
    umlClass: UmlClass,
) {
    node.members.forEach((member: VariableDeclaration) => {
        const [type, attributeType] = parseTypeName(member.typeName)
        umlClass.attributes.push({
            name: member.name,
            type,
            attributeType,
        })
    })

    addAssociations(node.members, umlClass)
}

export function parseEnumDefinition(node: EnumDefinition, umlClass: UmlClass) {
    let index = 0
    node.members.forEach((member: EnumValue) => {
        umlClass.attributes.push({
            name: member.name,
            type: (index++).toString(),
        })
    })

    addAssociations(node.members, umlClass)
}

export function parseContractDefinition(
    node: ContractDefinition,
    umlClass: UmlClass,
    umlClasses: UmlClass[],
) {
    umlClass.stereotype = parseContractKind(node.kind)

    node.baseContracts.forEach((baseClass) => {
        umlClass.addAssociation({
            referenceType: ReferenceType.Storage,
            targetUmlClassName: baseClass.baseName.namePath,
            realization: true,
        })
    })

    node.subNodes.forEach((subNode) => {
        if (isStateVariableDeclaration(subNode)) {
            subNode.variables.forEach(
                (variable: StateVariableDeclarationVariable) => {
                    const [type, attributeType] = parseTypeName(
                        variable.typeName,
                    )
                    const valueStore =
                        variable.isDeclaredConst || variable.isImmutable

                    umlClass.attributes.push({
                        visibility: parseVisibility(variable.visibility),
                        name: variable.name,
                        type,
                        attributeType,
                        compiled: valueStore,
                    })

                    if (variable.isDeclaredConst) {
                        if (variable?.expression?.type === 'NumberLiteral') {
                            umlClass.constants.push({
                                name: variable.name,
                                value: parseInt(variable.expression.number),
                            })
                        }
                        // TODO handle expressions. eg N_COINS * 2
                    }
                },
            )

            addAssociations(subNode.variables, umlClass)
        } else if (isUsingForDeclaration(subNode)) {
            umlClass.addAssociation({
                referenceType: ReferenceType.Memory,
                targetUmlClassName: (<UsingForDeclaration>subNode).libraryName,
            })
        } else if (isFunctionDefinition(subNode)) {
            if (subNode.isConstructor) {
                umlClass.operators.push({
                    name: 'constructor',
                    stereotype: OperatorStereotype.None,
                    parameters: parseParameters(subNode.parameters),
                })
            } else if (subNode.name === '') {
                umlClass.operators.push({
                    name: '',
                    stereotype: OperatorStereotype.Fallback,
                    parameters: parseParameters(subNode.parameters),
                    stateMutability: subNode.stateMutability,
                })
            } else {
                let stereotype = OperatorStereotype.None

                if (subNode.body === null) {
                    stereotype = OperatorStereotype.Abstract
                } else if (subNode.stateMutability === 'payable') {
                    stereotype = OperatorStereotype.Payable
                }

                umlClass.operators.push({
                    visibility: parseVisibility(subNode.visibility),
                    name: subNode.name,
                    stereotype,
                    parameters: parseParameters(subNode.parameters),
                    returnParameters: parseParameters(subNode.returnParameters),
                    modifiers: subNode.modifiers.map((m) => m.name),
                })
            }

            addAssociations(subNode.parameters, umlClass)
            if (subNode.returnParameters) {
                addAssociations(subNode.returnParameters, umlClass)
            }

            if (subNode.body === null) {
                if (umlClass.stereotype !== ClassStereotype.Interface) {
                    umlClass.stereotype = ClassStereotype.Abstract
                }
            } else {
                addAssociations(subNode.body.statements as ASTNode[], umlClass)
            }
        } else if (isModifierDefinition(subNode)) {
            umlClass.operators.push({
                stereotype: OperatorStereotype.Modifier,
                name: subNode.name,
                parameters: parseParameters(subNode.parameters),
            })

            if (subNode.body && subNode.body.statements) {
                addAssociations(subNode.body.statements as ASTNode[], umlClass)
            }
        } else if (isEventDefinition(subNode)) {
            umlClass.operators.push({
                stereotype: OperatorStereotype.Event,
                name: subNode.name,
                parameters: parseParameters(subNode.parameters),
            })

            addAssociations(subNode.parameters, umlClass)
        } else if (isStructDefinition(subNode)) {
            const structClass = new UmlClass({
                name: subNode.name,
                absolutePath: umlClass.absolutePath,
                relativePath: umlClass.relativePath,
                parentId: umlClass.id,
                stereotype: ClassStereotype.Struct,
            })
            parseStructDefinition(subNode, structClass)
            umlClasses.push(structClass)
            umlClass.structs.push(structClass.id)
        } else if (isEnumDefinition(subNode)) {
            const enumClass = new UmlClass({
                name: subNode.name,
                absolutePath: umlClass.absolutePath,
                relativePath: umlClass.relativePath,
                parentId: umlClass.id,
                stereotype: ClassStereotype.Enum,
            })
            parseEnumDefinition(subNode, enumClass)
            umlClasses.push(enumClass)
            umlClass.enums.push(enumClass.id)
        }
    })
}
