import { dotAttributeVisibilities } from './diagram/classAttributes.js'
import type { ClassOptions } from './diagram/classOptions.js'
import { dotClassTitle } from './diagram/classTitle.js'
import { dotOperatorVisibilities } from './diagram/classOperators.js'
import { ClassStereotype } from './umlClass.js'
import type { UmlClass } from './umlClass.js'

export type { ClassOptions } from './diagram/classOptions.js'

export const convertClass2Dot = (
    umlClass: UmlClass,
    options: ClassOptions = {},
): string => {
    if (
        umlClass.stereotype === ClassStereotype.Import ||
        (options.hideLibraries &&
            umlClass.stereotype === ClassStereotype.Library) ||
        (options.hideInterfaces &&
            umlClass.stereotype === ClassStereotype.Interface) ||
        (options.hideAbstracts &&
            umlClass.stereotype === ClassStereotype.Abstract) ||
        (options.hideStructs &&
            umlClass.stereotype === ClassStereotype.Struct) ||
        (options.hideEnums && umlClass.stereotype === ClassStereotype.Enum) ||
        (options.hideConstants &&
            umlClass.stereotype === ClassStereotype.Constant)
    ) {
        return ''
    }

    let dotString = `\n${umlClass.id} [label="{${dotClassTitle(
        umlClass,
        options,
    )}`

    if (!options.hideVariables) {
        dotString += dotAttributeVisibilities(umlClass, options)
    }

    if (!options.hideFunctions) {
        dotString += dotOperatorVisibilities(umlClass, options)
    }

    dotString += '}"]'

    return dotString
}
