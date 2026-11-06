import { AttributeType, ClassStereotype } from '../umlClass.js'
import type { Attribute, UmlClass } from '../umlClass.js'
import { findDimensionLength } from './array-dimensions.js'
import { STORAGE_SLOT_BYTES } from './constants.js'
import { calcElementaryTypeSize, isElementary } from './elementary-type-size.js'
import { findTypeClass } from './type-reference.js'

export const calcStorageByteSize = (
    attribute: Attribute,
    umlClass: UmlClass,
    otherClasses: readonly UmlClass[],
): { size: number; dynamic: boolean } => {
    if (
        attribute.attributeType === AttributeType.Mapping ||
        attribute.attributeType === AttributeType.Function
    ) {
        return { size: STORAGE_SLOT_BYTES, dynamic: true }
    }
    if (attribute.attributeType === AttributeType.Array) {
        // Fixed sized arrays are read from right to left until there is a dynamic dimension
        // eg address[][3][2] is a fixed size array that uses 6 slots.
        // while address [2][] is a dynamic sized array.
        const arrayDimensions = attribute.type.match(/\[[\w$.]*]/g)
        // Remove first [ and last ] from each arrayDimensions
        const dimensionsStr = arrayDimensions.map((a) => a.slice(1, -1))
        // fixed-sized arrays are read from right to left so reverse the dimensions
        const dimensionsStrReversed = dimensionsStr.reverse()

        // read fixed-size dimensions until we get a dynamic array with no dimension
        let dimension = dimensionsStrReversed.shift()
        const fixedDimensions: number[] = []
        while (dimension && dimension !== '') {
            const dimensionNum = findDimensionLength(
                umlClass,
                dimension,
                otherClasses,
            )
            fixedDimensions.push(dimensionNum)
            // read the next dimension for the next loop
            dimension = dimensionsStrReversed.shift()
        }

        // If the first dimension is dynamic, ie []
        if (fixedDimensions.length === 0) {
            // dynamic arrays start at the keccak256 of the slot number
            // The array length occupies its declaration slot.
            return { size: STORAGE_SLOT_BYTES, dynamic: true }
        }

        // If a fixed sized array
        let elementSize: number
        const type = attribute.type.substring(0, attribute.type.indexOf('['))
        if (isElementary(type)) {
            const elementAttribute: Attribute = {
                attributeType: AttributeType.Elementary,
                type,
                name: 'element',
            }
            ;({ size: elementSize } = calcStorageByteSize(
                elementAttribute,
                umlClass,
                otherClasses,
            ))
        } else {
            const elementAttribute: Attribute = {
                attributeType: AttributeType.UserDefined,
                type,
                name: 'userDefined',
            }
            ;({ size: elementSize } = calcStorageByteSize(
                elementAttribute,
                umlClass,
                otherClasses,
            ))
        }
        if (
            elementSize > STORAGE_SLOT_BYTES / 2 &&
            elementSize < STORAGE_SLOT_BYTES
        ) {
            elementSize = STORAGE_SLOT_BYTES
        }
        if (fixedDimensions.length < arrayDimensions.length) {
            const totalDimensions = fixedDimensions.reduce(
                (total, dimension) => total * dimension,
                1,
            )
            return {
                size: STORAGE_SLOT_BYTES * totalDimensions,
                dynamic: false,
            }
        }
        const lastItem = fixedDimensions.length - 1
        const lastArrayLength = fixedDimensions[lastItem]
        const itemsPerSlot = Math.floor(STORAGE_SLOT_BYTES / elementSize)
        const lastDimensionBytes =
            itemsPerSlot > 0 // if one or more array items in a slot
                ? Math.ceil(lastArrayLength / itemsPerSlot) * STORAGE_SLOT_BYTES // round up to include unallocated slot space
                : elementSize * fixedDimensions[lastItem]

        const lastDimensionSlotBytes =
            Math.ceil(lastDimensionBytes / STORAGE_SLOT_BYTES) *
            STORAGE_SLOT_BYTES
        const remainingDimensions = fixedDimensions
            .slice(0, lastItem)
            .reduce((total, dimension) => total * dimension, 1)
        return {
            size: lastDimensionSlotBytes * remainingDimensions,
            dynamic: false,
        }
    }
    // If a Struct, Enum or Contract reference
    // TODO need to handle User Defined Value Types when they are added to Solidity
    if (attribute.attributeType === AttributeType.UserDefined) {
        // Is the user defined type linked to another Contract, Struct or Enum?
        const attributeTypeClass = findTypeClass(
            attribute.type,
            attribute,
            umlClass,
            otherClasses,
        )

        switch (attributeTypeClass.stereotype) {
            case ClassStereotype.Enum:
                return { size: 1, dynamic: false }
            case ClassStereotype.Contract:
            case ClassStereotype.Abstract:
            case ClassStereotype.Interface:
            case ClassStereotype.Library:
                return { size: 20, dynamic: false }
            case ClassStereotype.Struct: {
                let structByteSize = 0
                attributeTypeClass.attributes.forEach((structAttribute) => {
                    // If next attribute is an array, then we need to start in a new slot
                    if (structAttribute.attributeType === AttributeType.Array) {
                        structByteSize =
                            Math.ceil(structByteSize / STORAGE_SLOT_BYTES) *
                            STORAGE_SLOT_BYTES
                    }
                    // If next attribute is an struct, then we need to start in a new slot
                    else if (
                        structAttribute.attributeType ===
                        AttributeType.UserDefined
                    ) {
                        // UserDefined types can be a struct or enum, so we need to check if it's a struct
                        const userDefinedClass = findTypeClass(
                            structAttribute.type,
                            structAttribute,
                            attributeTypeClass,
                            otherClasses,
                        )
                        // If a struct
                        if (
                            userDefinedClass.stereotype ===
                            ClassStereotype.Struct
                        ) {
                            structByteSize =
                                Math.ceil(structByteSize / STORAGE_SLOT_BYTES) *
                                STORAGE_SLOT_BYTES
                        }
                    }
                    const { size: attributeSize } = calcStorageByteSize(
                        structAttribute,
                        attributeTypeClass,
                        otherClasses,
                    )
                    // check if attribute will fit into the remaining slot
                    const endCurrentSlot =
                        Math.ceil(structByteSize / STORAGE_SLOT_BYTES) *
                        STORAGE_SLOT_BYTES
                    const spaceLeftInSlot = endCurrentSlot - structByteSize
                    if (attributeSize <= spaceLeftInSlot) {
                        structByteSize += attributeSize
                    } else {
                        structByteSize = endCurrentSlot + attributeSize
                    }
                })
                return {
                    size:
                        Math.ceil(structByteSize / STORAGE_SLOT_BYTES) *
                        STORAGE_SLOT_BYTES,
                    dynamic: false,
                }
            }
            default:
                return { size: 20, dynamic: false }
        }
    }

    if (attribute.attributeType === AttributeType.Elementary) {
        return calcElementaryTypeSize(attribute.type)
    }
    throw new Error(
        `Failed to calc bytes size of attribute with name "${attribute.name}" and type ${attribute.type}`,
    )
}
