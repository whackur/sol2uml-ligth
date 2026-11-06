import { ClassStereotype, OperatorStereotype, Visibility } from '../umlClass.js'
import type { Operator, Parameter, UmlClass } from '../umlClass.js'

export const dotOperatorVisibilities = (
    umlClass: UmlClass,
    options: {
        hidePrivates?: boolean
        hideModifiers?: boolean
        hideEvents?: boolean
    },
): string => {
    if (umlClass.operators.length === 0) return ''

    let dotString = '| '

    for (const vizGroup of ['Private', 'Internal', 'External', 'Public']) {
        const operators: Operator[] = []

        for (const operator of umlClass.operators) {
            if (
                !options.hidePrivates &&
                vizGroup === 'Private' &&
                operator.visibility === Visibility.Private
            ) {
                operators.push(operator)
            } else if (
                !options.hidePrivates &&
                vizGroup === 'Internal' &&
                operator.visibility === Visibility.Internal
            ) {
                operators.push(operator)
            } else if (
                vizGroup === 'External' &&
                operator.visibility === Visibility.External
            ) {
                operators.push(operator)
            } else if (
                vizGroup === 'Public' &&
                (operator.visibility === Visibility.Public ||
                    operator.visibility === Visibility.None ||
                    !operator.visibility)
            ) {
                operators.push(operator)
            }
        }

        dotString += dotOperators(umlClass, vizGroup, operators, options)
    }

    return dotString
}

const dotOperators = (
    umlClass: UmlClass,
    vizGroup: string,
    operators: Operator[],
    options: {
        hideTypes?: boolean
        hideModifiers?: boolean
        hideEvents?: boolean
        hideSourceContract?: boolean
    },
): string => {
    if (!operators || operators.length === 0) {
        return ''
    }

    let dotString = vizGroup + ':\\l'

    const operatorsSortedByStereotype = operators.sort((a, b) => {
        return b.stereotype - a.stereotype
    })
    const operatorsFiltered = operatorsSortedByStereotype.filter(
        (o) =>
            !(
                (options.hideModifiers === true &&
                    o.stereotype === OperatorStereotype.Modifier) ||
                (options.hideEvents === true &&
                    o.stereotype === OperatorStereotype.Event)
            ),
    )

    for (const operator of operatorsFiltered) {
        dotString += '\\ \\ \\ \\ '

        if (operator.stereotype > 0) {
            dotString += dotOperatorStereotype(umlClass, operator.stereotype)
        }

        dotString += operator.name
        dotString += dotParameters(
            operator.parameters,
            false,
            options.hideTypes,
        )

        if (operator.returnParameters?.length > 0 && !options.hideTypes) {
            dotString += ': ' + dotParameters(operator.returnParameters, true)
        }

        if (options.hideModifiers === false && operator.modifiers?.length > 0) {
            dotString += ` \\<\\<${operator.modifiers.join(', ')}\\>\\>`
        }

        if (operator.sourceContract && !options.hideSourceContract) {
            dotString += ` \\<\\<${operator.sourceContract}\\>\\>`
        }

        dotString += '\\l'
    }

    return dotString
}

const dotOperatorStereotype = (
    umlClass: UmlClass,
    operatorStereotype: OperatorStereotype,
): string => {
    let dotString = ''

    switch (operatorStereotype) {
        case OperatorStereotype.Event:
            dotString += '\\<\\<event\\>\\>'
            break
        case OperatorStereotype.Fallback:
            dotString += '\\<\\<fallback\\>\\>'
            break
        case OperatorStereotype.Modifier:
            dotString += '\\<\\<modifier\\>\\>'
            break
        case OperatorStereotype.Abstract:
            if (umlClass.stereotype === ClassStereotype.Abstract) {
                dotString += '\\<\\<abstract\\>\\>'
            }
            break
        case OperatorStereotype.Payable:
            dotString += '\\<\\<payable\\>\\>'
            break
        default:
            break
    }

    return dotString + ' '
}

const dotParameters = (
    parameters: Parameter[],
    returnParams: boolean = false,
    hideTypes: boolean = false,
): string => {
    if (hideTypes && !returnParams) {
        return '()'
    }
    if (parameters.length == 1 && !parameters[0].name) {
        if (returnParams) {
            return parameters[0].type
        } else {
            return `(${parameters[0].type})`
        }
    }

    let dotString = '('
    let paramCount = 0

    for (const parameter of parameters) {
        if (parameter.name === null) {
            dotString += parameter.type
        } else {
            dotString += parameter.name + ': ' + parameter.type
        }

        if (++paramCount < parameters.length) {
            dotString += ', '
        }
    }

    return dotString + ')'
}
