import { isAddress } from '../utils/regEx.js'
import { ClassStereotype } from '../umlClass.js'
import type { UmlClass } from '../umlClass.js'

export const dotClassTitle = (
    umlClass: UmlClass,
    options: { hideFilename?: boolean } = {},
): string => {
    let stereoName: string
    const relativePath =
        options.hideFilename || isAddress(umlClass.relativePath)
            ? ''
            : `\\n${umlClass.relativePath}`
    switch (umlClass.stereotype) {
        case ClassStereotype.Abstract:
            stereoName = 'Abstract'
            break
        case ClassStereotype.Interface:
            stereoName = 'Interface'
            break
        case ClassStereotype.Library:
            stereoName = 'Library'
            break
        case ClassStereotype.Struct:
            stereoName = 'Struct'
            break
        case ClassStereotype.Enum:
            stereoName = 'Enum'
            break
        case ClassStereotype.Constant:
            stereoName = 'Constant'
            break
        default:
            return `${umlClass.name}${relativePath}`
    }

    return `\\<\\<${stereoName}\\>\\>\\n${umlClass.name}${relativePath}`
}
