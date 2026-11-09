import { AttributeType } from '../umlClass.js'
import type { UmlClass } from '../umlClass.js'
import { findAssociatedClass } from '../classes/associations.js'
import { calcStorageByteSize } from './storage-byte-size.js'
import { calcDisplayValue, calcGetValue } from './value-rules.js'
import { STORAGE_SLOT_BYTES } from './constants.js'
import { nextVariableId } from './identifiers.js'
import type { ParseStorageSection } from './parser-types.js'
import type { StorageSection, Variable } from './types.js'

export const parseVariables = (
    umlClass: UmlClass,
    umlClasses: readonly UmlClass[],
    variables: Variable[],
    storageSections: StorageSection[],
    inheritedContracts: string[],
    mapping: boolean,
    arrayItems: number,
    noExpandVariables: string[],
    parseStorageSection: ParseStorageSection,
): Variable[] => {
    // Base contract attributes must occupy storage before derived attributes.
    const parentContracts = umlClass.getParentContracts()
    const newInheritedContracts = parentContracts.filter(
        (parentContract) =>
            !inheritedContracts.includes(parentContract.targetUmlClassName),
    )
    inheritedContracts.push(
        ...newInheritedContracts.map((c) => c.targetUmlClassName),
    )
    newInheritedContracts.forEach((parent) => {
        const parentClass = findAssociatedClass(parent, umlClass, umlClasses)
        if (!parentClass) {
            throw Error(
                `Failed to find inherited contract "${parent.targetUmlClassName}" sourced from "${umlClass.name}" with path "${umlClass.absolutePath}"`,
            )
        }
        parseVariables(
            parentClass,
            umlClasses,
            variables,
            storageSections,
            inheritedContracts,
            mapping,
            arrayItems,
            noExpandVariables,
            parseStorageSection,
        )
    })

    umlClass.attributes.forEach((attribute) => {
        if (attribute.compiled) return

        const { size: byteSize, dynamic } = calcStorageByteSize(
            attribute,
            umlClass,
            umlClasses,
        )

        const references = noExpandVariables.includes(attribute.name)
            ? undefined
            : parseStorageSection(
                  attribute,
                  umlClass,
                  umlClasses,
                  storageSections,
                  mapping || attribute.attributeType === AttributeType.Mapping,
                  arrayItems,
                  noExpandVariables,
              )

        const displayValue = calcDisplayValue(
            attribute.attributeType,
            dynamic,
            mapping,
            references?.storageSection?.type,
        )
        const getValue = calcGetValue(attribute.attributeType, mapping)

        const lastVariable = variables[variables.length - 1]
        const lastToSlot = lastVariable ? lastVariable.toSlot : 0
        const nextOffset = lastVariable
            ? lastVariable.byteOffset + lastVariable.byteSize
            : 0
        let fromSlot
        let toSlot
        let byteOffset
        // Move to the next slot only when the attribute no longer fits here.
        if (nextOffset + byteSize > STORAGE_SLOT_BYTES) {
            const nextFromSlot = variables.length > 0 ? lastToSlot + 1 : 0
            fromSlot = nextFromSlot
            toSlot =
                nextFromSlot + Math.floor((byteSize - 1) / STORAGE_SLOT_BYTES)
            byteOffset = 0
        } else {
            fromSlot = lastToSlot
            toSlot = lastToSlot
            byteOffset = nextOffset
        }
        variables.push({
            id: nextVariableId(),
            fromSlot,
            toSlot,
            byteSize,
            byteOffset,
            type: attribute.type,
            attributeType: attribute.attributeType,
            dynamic,
            getValue,
            displayValue,
            name: attribute.name,
            contractName: umlClass.name,
            referenceSectionId: references?.storageSection?.id,
            enumValues: references?.enumValues,
        })
    })

    return variables
}
