import { ClassStereotype, Visibility } from '../umlClass.js'
import type { Attribute, UmlClass } from '../umlClass.js'

export const dotAttributeVisibilities = (
    umlClass: UmlClass,
    options: {
        hidePrivates?: boolean
        hideTypes?: boolean
        hideSourceContract?: boolean
    },
): string => {
    if (umlClass.attributes.length === 0) return ''

    let dotString = '| '
    if (
        umlClass.stereotype === ClassStereotype.Struct ||
        umlClass.stereotype === ClassStereotype.Enum ||
        umlClass.stereotype === ClassStereotype.Constant
    ) {
        return (
            dotString +
            dotAttributes(umlClass.attributes, options, undefined, false)
        )
    }

    for (const vizGroup of ['Private', 'Internal', 'External', 'Public']) {
        const attributes: Attribute[] = []

        for (const attribute of umlClass.attributes) {
            if (
                !options.hidePrivates &&
                vizGroup === 'Private' &&
                attribute.visibility === Visibility.Private
            ) {
                attributes.push(attribute)
            } else if (
                !options.hidePrivates &&
                vizGroup === 'Internal' &&
                attribute.visibility === Visibility.Internal
            ) {
                attributes.push(attribute)
            } else if (
                vizGroup === 'External' &&
                attribute.visibility === Visibility.External
            ) {
                attributes.push(attribute)
            } else if (
                vizGroup === 'Public' &&
                (attribute.visibility === Visibility.Public ||
                    attribute.visibility === Visibility.None ||
                    !attribute.visibility)
            ) {
                attributes.push(attribute)
            }
        }

        dotString += dotAttributes(attributes, options, vizGroup)
    }

    return dotString
}

const dotAttributes = (
    attributes: Attribute[],
    options: { hideTypes?: boolean; hideSourceContract?: boolean },
    vizGroup?: string,
    indent = true,
): string => {
    if (!attributes || attributes.length === 0) {
        return ''
    }
    const indentString = indent ? '\\ \\ \\ ' : ''

    let dotString = vizGroup ? vizGroup + ':\\l' : ''

    attributes.forEach((attribute) => {
        const sourceContract =
            attribute.sourceContract && !options.hideSourceContract
                ? ` \\<\\<${attribute.sourceContract}\\>\\>`
                : ''
        const type = options.hideTypes ? '' : `: ${attribute.type}`
        dotString += `${indentString}${attribute.name}${type}${sourceContract}\\l`
    })

    return dotString
}
