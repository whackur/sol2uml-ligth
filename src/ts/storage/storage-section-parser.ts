import { AttributeType, ClassStereotype } from '../umlClass.js'
import type { Attribute, UmlClass } from '../umlClass.js'
import { addArrayVariables } from './array-variables.js'
import { findDimensionLength } from './array-dimensions.js'
import { STORAGE_SLOT_BYTES } from './constants.js'
import { nextStorageId, nextVariableId } from './identifiers.js'
import { parseVariables } from './variable-parser.js'
import { calcStorageByteSize } from './storage-byte-size.js'
import { isElementary } from './elementary-type-size.js'
import { findTypeClass } from './type-reference.js'
import type { StorageSection, Variable } from './types.js'
import { StorageSectionType } from './types.js'
import { calcDisplayValue, calcGetValue } from './value-rules.js'

export const parseStorageSectionFromAttribute = (
    attribute: Attribute,
    umlClass: UmlClass,
    otherClasses: readonly UmlClass[],
    storageSections: StorageSection[],
    mapping: boolean,
    arrayItems: number,
    noExpandVariables: string[],
): {
    storageSection: StorageSection
    enumValues?: string[]
} => {
    if (attribute.attributeType === AttributeType.Array) {
        const result = attribute.type.match(/\[([\w$.]*)]$/)
        const dynamic = result[1] === ''
        const arrayLength = !dynamic
            ? findDimensionLength(umlClass, result[1], otherClasses)
            : undefined

        // address[][4][2] uses address[][4] as its base item type.
        const baseType = attribute.type.substring(
            0,
            attribute.type.lastIndexOf('['),
        )
        let baseAttributeType: AttributeType
        if (isElementary(baseType)) {
            baseAttributeType = AttributeType.Elementary
        } else if (baseType[baseType.length - 1] === ']') {
            baseAttributeType = AttributeType.Array
        } else {
            baseAttributeType = AttributeType.UserDefined
        }

        const baseAttribute: Attribute = {
            visibility: attribute.visibility,
            name: attribute.name,
            type: baseType,
            attributeType: baseAttributeType,
        }
        const { size: arrayItemSize, dynamic: dynamicBase } =
            calcStorageByteSize(baseAttribute, umlClass, otherClasses)
        const arraySlotSize =
            arrayItemSize > 16
                ? STORAGE_SLOT_BYTES *
                  Math.ceil(arrayItemSize / STORAGE_SLOT_BYTES)
                : arrayItemSize

        let references
        if (baseAttributeType !== AttributeType.Elementary) {
            references = parseStorageSectionFromAttribute(
                baseAttribute,
                umlClass,
                otherClasses,
                storageSections,
                mapping,
                arrayItems,
                noExpandVariables,
            )
        }

        const displayValue = calcDisplayValue(
            baseAttribute.attributeType,
            dynamicBase,
            mapping,
            references?.storageSection?.type,
        )
        const getValue = calcGetValue(attribute.attributeType, mapping)

        const variables: Variable[] = []
        variables[0] = {
            id: nextVariableId(),
            fromSlot: 0,
            toSlot: Math.floor((arraySlotSize - 1) / STORAGE_SLOT_BYTES),
            byteSize: arrayItemSize,
            byteOffset: 0,
            type: baseType,
            attributeType: baseAttributeType,
            dynamic: dynamicBase,
            getValue,
            displayValue,
            referenceSectionId: references?.storageSection?.id,
            enumValues: references?.enumValues,
        }

        if (arrayLength > 1) {
            addArrayVariables(arrayLength, arrayItems, variables)

            variables.forEach((variable, i) => {
                if (
                    i > 0 &&
                    baseAttributeType !== AttributeType.Elementary &&
                    variable.type !== '----' // ignore any filler variables
                ) {
                    references = parseStorageSectionFromAttribute(
                        baseAttribute,
                        umlClass,
                        otherClasses,
                        storageSections,
                        mapping,
                        arrayItems,
                        noExpandVariables,
                    )
                    variable.referenceSectionId = references?.storageSection?.id
                    variable.enumValues = references?.enumValues
                }
            })
        }

        const storageSection = {
            id: nextStorageId(),
            name: `${attribute.type}: ${attribute.name}`,
            type: StorageSectionType.Array,
            arrayDynamic: dynamic,
            arrayLength,
            variables,
            mapping,
        }
        storageSections.push(storageSection)

        return { storageSection }
    }
    if (attribute.attributeType === AttributeType.UserDefined) {
        const typeClass = findTypeClass(
            attribute.type,
            attribute,
            umlClass,
            otherClasses,
        )

        if (typeClass.stereotype === ClassStereotype.Struct) {
            const variables = parseVariables(
                typeClass,
                otherClasses,
                [],
                storageSections,
                [],
                mapping,
                arrayItems,
                noExpandVariables,
                parseStorageSectionFromAttribute,
            )
            const storageSection = {
                id: nextStorageId(),
                name: attribute.type,
                type: StorageSectionType.Struct,
                variables,
                mapping,
            }
            storageSections.push(storageSection)

            return { storageSection }
        } else if (typeClass.stereotype === ClassStereotype.Enum) {
            return {
                storageSection: undefined,
                enumValues: typeClass.attributes.map((a) => a.name),
            }
        }
        return undefined
    }
    if (attribute.attributeType === AttributeType.Mapping) {
        const result = attribute.type.match(/=\\>((?!mapping)[\w$.]*)[\\[]/)
        if (result !== null && result[1] && !isElementary(result[1])) {
            const typeClass = findTypeClass(
                result[1],
                attribute,
                umlClass,
                otherClasses,
            )

            if (typeClass.stereotype === ClassStereotype.Struct) {
                const variables = parseVariables(
                    typeClass,
                    otherClasses,
                    [],
                    storageSections,
                    [],
                    true,
                    arrayItems,
                    noExpandVariables,
                    parseStorageSectionFromAttribute,
                )
                const storageSection = {
                    id: nextStorageId(),
                    name: typeClass.name,
                    type: StorageSectionType.Struct,
                    mapping: true,
                    variables,
                }
                storageSections.push(storageSection)

                return { storageSection }
            }
        }
        return undefined
    }
    return undefined
}
