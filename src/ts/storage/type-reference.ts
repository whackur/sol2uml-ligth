import { ReferenceType } from '../umlClass.js'
import type { Attribute, UmlClass } from '../umlClass.js'
import { findAssociatedClass } from '../classes/associations.js'

export const findTypeClass = (
    userType: string,
    attribute: Attribute,
    umlClass: UmlClass,
    otherClasses: readonly UmlClass[],
): UmlClass => {
    const types = userType.split('.')
    const association = {
        referenceType: ReferenceType.Memory,
        targetUmlClassName: types.length === 1 ? types[0] : types[1],
        parentUmlClassName: types.length === 1 ? undefined : types[0],
    }
    const typeClass = findAssociatedClass(association, umlClass, otherClasses)
    if (!typeClass) {
        throw Error(
            `Failed to find user defined type "${userType}" in attribute "${attribute.name}" of from class "${umlClass.name}" with path "${umlClass.absolutePath}"`,
        )
    }
    return typeClass
}
