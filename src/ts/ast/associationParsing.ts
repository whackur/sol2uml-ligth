import type {
    ASTNode,
    Expression,
    TypeName,
} from '@solidity-parser/parser/dist/src/ast-types'
import { AttributeType, ReferenceType, UmlClass } from '../umlClass.js'
import { parseClassName } from './typeParsing.js'

const debug = require('debug')('sol2uml-light')

export function addAssociations(
    nodes: (ASTNode & { isStateVar?: boolean })[],
    umlClass: UmlClass,
) {
    if (!nodes || !Array.isArray(nodes)) {
        debug(
            'Warning - can not recursively parse AST nodes for associations. Invalid nodes array',
        )
        return
    }

    for (const node of nodes) {
        // Some variables can be null. eg var (lad,,,) = tub.cups(cup);
        if (node === null) {
            break
        }

        const referenceType = node.isStateVar!
            ? ReferenceType.Storage
            : ReferenceType.Memory

        switch (node.type) {
            case 'VariableDeclaration':
                if (!node.typeName) {
                    break
                }
                addTypeNameAssociations(node.typeName, referenceType, umlClass)
                break
            case 'UserDefinedTypeName':
                addUserDefinedTypeAssociation(
                    node.namePath,
                    referenceType,
                    umlClass,
                )
                break
            case 'Block':
                addAssociations(node.statements as ASTNode[], umlClass)
                break
            case 'StateVariableDeclaration':
            case 'VariableDeclarationStatement':
                addAssociations(node.variables as ASTNode[], umlClass)
                parseExpression(node.initialValue, umlClass)
                break
            case 'EmitStatement':
                addAssociations(node.eventCall.arguments as ASTNode[], umlClass)
                parseExpression(node.eventCall.expression, umlClass)
                break
            case 'FunctionCall':
                addAssociations(node.arguments as ASTNode[], umlClass)
                parseExpression(node.expression, umlClass)
                break
            case 'ForStatement':
                if ('statements' in node.body) {
                    addAssociations(node.body.statements as ASTNode[], umlClass)
                }
                parseExpression(node.conditionExpression, umlClass)
                parseExpression(node.loopExpression.expression, umlClass)
                break
            case 'WhileStatement':
                if ('statements' in node.body) {
                    addAssociations(node.body.statements as ASTNode[], umlClass)
                }
                break
            case 'DoWhileStatement':
                if ('statements' in node.body) {
                    addAssociations(node.body.statements as ASTNode[], umlClass)
                }
                parseExpression(node.condition, umlClass)
                break
            case 'ReturnStatement':
            case 'ExpressionStatement':
                parseExpression(node.expression, umlClass)
                break
            case 'IfStatement':
                if (node.trueBody) {
                    if ('statements' in node.trueBody) {
                        addAssociations(
                            node.trueBody.statements as ASTNode[],
                            umlClass,
                        )
                    }
                    if ('expression' in node.trueBody) {
                        parseExpression(node.trueBody.expression, umlClass)
                    }
                }
                if (node.falseBody) {
                    if ('statements' in node.falseBody) {
                        addAssociations(
                            node.falseBody.statements as ASTNode[],
                            umlClass,
                        )
                    }
                    if ('expression' in node.falseBody) {
                        parseExpression(node.falseBody.expression, umlClass)
                    }
                }

                parseExpression(node.condition, umlClass)
                break
            default:
                break
        }
    }
}

function addTypeNameAssociations(
    typeName: TypeName,
    referenceType: ReferenceType,
    umlClass: UmlClass,
) {
    switch (typeName.type) {
        case 'UserDefinedTypeName':
            addUserDefinedTypeAssociation(
                typeName.namePath,
                referenceType,
                umlClass,
            )
            break
        case 'Mapping':
            addTypeNameAssociations(
                typeName.keyType,
                ReferenceType.Memory,
                umlClass,
            )
            addTypeNameAssociations(typeName.valueType, referenceType, umlClass)
            break
        case 'ArrayTypeName':
            addTypeNameAssociations(
                typeName.baseTypeName,
                referenceType,
                umlClass,
            )
            if (typeName.length?.type === 'Identifier') {
                const { umlClassName } = parseClassName(typeName.length.name)
                umlClass.addAssociation({
                    referenceType,
                    targetUmlClassName: umlClassName,
                })
            }
            break
        default:
            break
    }
}

function addUserDefinedTypeAssociation(
    namePath: string,
    referenceType: ReferenceType,
    umlClass: UmlClass,
) {
    const { umlClassName, structOrEnum } = parseClassName(namePath)
    umlClass.addAssociation({
        referenceType,
        targetUmlClassName: umlClassName,
    })
    if (structOrEnum) {
        umlClass.addAssociation({
            referenceType,
            parentUmlClassName: umlClassName,
            targetUmlClassName: structOrEnum,
        })
    }
}

export function parseExpression(expression: Expression, umlClass: UmlClass) {
    if (!expression || !expression.type) {
        return
    }
    if (expression.type === 'BinaryOperation') {
        parseExpression(expression.left, umlClass)
        parseExpression(expression.right, umlClass)
    } else if (expression.type === 'FunctionCall') {
        if (
            expression.expression.type === 'MemberAccess' &&
            expression.expression.expression?.type === 'Identifier'
        ) {
            const memberName = expression.expression.memberName
            const identifierName = expression.expression.expression.name
            const storageAttr = umlClass.attributes.find(
                (attr) =>
                    attr.name === identifierName &&
                    attr.attributeType === AttributeType.UserDefined,
            )
            if (storageAttr) {
                const { umlClassName } = parseClassName(storageAttr.type)
                umlClass.addAssociation({
                    referenceType: ReferenceType.Storage,
                    targetUmlClassName: umlClassName,
                    functionsCalled: [memberName],
                })
            } else {
                umlClass.addAssociation({
                    referenceType: ReferenceType.Memory,
                    targetUmlClassName: identifierName,
                    functionsCalled: [memberName],
                })
            }
            umlClass.memberAccessCalls.add(memberName)
        } else {
            if (expression.expression.type === 'MemberAccess') {
                umlClass.memberAccessCalls.add(expression.expression.memberName)
            }
            parseExpression(expression.expression, umlClass)
        }
        expression.arguments.forEach((arg) => {
            parseExpression(arg, umlClass)
        })
    } else if (expression.type === 'IndexAccess') {
        parseExpression(expression.base, umlClass)
        parseExpression(expression.index, umlClass)
    } else if (expression.type === 'TupleExpression') {
        expression.components.forEach((component) => {
            parseExpression(component as Expression, umlClass)
        })
    } else if (expression.type === 'MemberAccess') {
        parseExpression(expression.expression, umlClass)
    } else if (expression.type === 'Conditional') {
        addAssociations([expression.trueExpression], umlClass)
        addAssociations([expression.falseExpression], umlClass)
    } else if (expression.type === 'Identifier') {
        umlClass.addAssociation({
            referenceType: ReferenceType.Memory,
            targetUmlClassName: expression.name,
        })
    } else if (expression.type === 'NewExpression') {
        addAssociations([expression.typeName], umlClass)
    } else if (
        expression.type === 'UnaryOperation' &&
        expression.subExpression
    ) {
        parseExpression(expression.subExpression, umlClass)
    }
}
