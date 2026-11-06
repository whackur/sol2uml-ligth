import type {
    ElementaryTypeName,
    TypeName,
    UserDefinedTypeName,
    VariableDeclaration,
} from '@solidity-parser/parser/dist/src/ast-types'
import { AttributeType, ClassStereotype, Visibility } from '../umlClass.js'
import type { Parameter } from '../umlClass.js'

export function parseClassName(rawClassName: string): {
    umlClassName: string
    structOrEnum: string
} {
    if (
        !rawClassName ||
        typeof rawClassName !== 'string' ||
        rawClassName.length === 0
    ) {
        return {
            umlClassName: '',
            structOrEnum: rawClassName,
        }
    }

    const splitUmlClassName = rawClassName.split('.')
    return {
        umlClassName: splitUmlClassName[0],
        structOrEnum: splitUmlClassName[1],
    }
}

export function parseVisibility(visibility: string): Visibility {
    switch (visibility) {
        case 'default':
            return Visibility.Public
        case 'public':
            return Visibility.Public
        case 'external':
            return Visibility.External
        case 'internal':
            return Visibility.Internal
        case 'private':
            return Visibility.Private
        default:
            throw Error(
                `Invalid visibility ${visibility}. Was not public, external, internal or private`,
            )
    }
}

export function parseTypeName(typeName: TypeName): [string, AttributeType] {
    switch (typeName.type) {
        case 'ElementaryTypeName':
            return [typeName.name, AttributeType.Elementary]
        case 'UserDefinedTypeName':
            return [typeName.namePath, AttributeType.UserDefined]
        case 'FunctionTypeName':
            // TODO add params and return type
            return [typeName.type + '\\(\\)', AttributeType.Function]
        case 'ArrayTypeName': {
            const [arrayElementType] = parseTypeName(typeName.baseTypeName)
            let length: string = ''
            if (Number.isInteger(typeName.length)) {
                length = typeName.length.toString()
            } else if (typeName.length?.type === 'NumberLiteral') {
                length = typeName.length.number
            } else if (typeName.length?.type === 'Identifier') {
                length = typeName.length.name
            }
            // TODO does not currently handle Expression types like BinaryOperation
            return [arrayElementType + '[' + length + ']', AttributeType.Array]
        }
        case 'Mapping': {
            const key =
                (<ElementaryTypeName>typeName.keyType)?.name ||
                (<UserDefinedTypeName>typeName.keyType)?.namePath
            const [valueType] = parseTypeName(typeName.valueType)
            return [
                'mapping\\(' + key + '=\\>' + valueType + '\\)',
                AttributeType.Mapping,
            ]
        }
        default:
            throw Error(`Invalid typeName ${typeName}`)
    }
}

export function parseParameters(
    params: readonly VariableDeclaration[],
): Parameter[] {
    if (!params || !params) {
        return []
    }

    const parameters: Parameter[] = []

    for (const param of params) {
        const [type] = parseTypeName(param.typeName)
        parameters.push({
            name: param.name,
            type,
        })
    }

    return parameters
}

export function parseContractKind(kind: string): ClassStereotype {
    switch (kind) {
        case 'contract':
            return ClassStereotype.Contract
        case 'interface':
            return ClassStereotype.Interface
        case 'library':
            return ClassStereotype.Library
        case 'abstract':
            return ClassStereotype.Abstract
        default:
            throw Error(`Invalid kind ${kind}`)
    }
}
