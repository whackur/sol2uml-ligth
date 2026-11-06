import { ClassStereotype } from '../umlClass.js'
import type { UmlClass } from '../umlClass.js'

export const findDimensionLength = (
    umlClass: UmlClass,
    dimension: string,
    otherClasses: readonly UmlClass[],
): number => {
    const dimensionNum = parseInt(dimension)
    if (Number.isInteger(dimensionNum)) {
        return dimensionNum
    }

    const constant = umlClass.constants.find(
        (constant) => constant.name === dimension,
    )
    if (constant) {
        return constant.value
    }

    if (umlClass.parentId !== undefined) {
        const parent = otherClasses.find(({ id }) => id === umlClass.parentId)
        const parentConstant = parent?.constants.find(
            (candidate) => candidate.name === dimension,
        )
        if (parentConstant) {
            return parentConstant.value
        }
    }

    const fileConstant = otherClasses.find(
        (umlClass) =>
            umlClass.name === dimension &&
            umlClass.stereotype === ClassStereotype.Constant,
    )
    if (fileConstant?.constants[0]?.value) {
        return fileConstant.constants[0].value
    }
    throw Error(
        `Could not size fixed sized array with dimension "${dimension}"`,
    )
}
