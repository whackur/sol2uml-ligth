import { getAddress } from '../utils/evm.js'
import { AttributeType } from '../umlClass.js'
import type { Variable } from '../storage/types.js'
import { convert2String } from './string-format.js'

const commify = (value: string): string => {
    const match = value.match(/^(-?)(\d+)(\.(.*))?$/)
    if (!match) return value
    const neg = match[1]
    const whole = match[2]
    const frac = match[4] ? '.' + match[4] : ''
    return neg + whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + frac
}

export const parseValue = (variable: Variable): string | undefined => {
    if (!variable.slotValue) return undefined
    const start = 66 - (variable.byteOffset + variable.byteSize) * 2
    const end = 66 - variable.byteOffset * 2
    const variableValue = variable.slotValue.substring(start, end)

    try {
        if (variable.attributeType === AttributeType.UserDefined) {
            return parseUserDefinedValue(variable, variableValue)
        }

        if (variable.attributeType === AttributeType.Elementary)
            return parseElementaryValue(variable, variableValue)

        if (
            variable.attributeType === AttributeType.Array &&
            variable.dynamic
        ) {
            return BigInt('0x' + variableValue).toString()
        }

        return undefined
    } catch (err) {
        throw Error(
            `Failed to parse variable ${variable.name} of type ${variable.type}, value "${variableValue}"`,
            { cause: err },
        )
    }
}
const parseUserDefinedValue = (
    variable: Variable,
    variableValue: string,
): string | undefined => {
    // TODO need to handle User Defined Value Types introduced in Solidity
    // https://docs.soliditylang.org/en/v0.8.38/types.html#user-defined-value-types
    // https://blog.soliditylang.org/2021/09/27/user-defined-value-types/

    // using byteSize is crude and will be incorrect for aliases types like int160 or uint160
    if (variable.byteSize === 20) {
        return getAddress('0x' + variableValue)
    }
    // this will also be wrong if the alias is to a 1 byte type. eg bytes1, int8 or uint8
    if (variable.byteSize === 1) {
        // assume 1 byte is an enum so convert value to enum index number
        const index = Number(BigInt('0x' + variableValue))
        // lookup enum value if its available
        return variable?.enumValues ? variable?.enumValues[index] : undefined
    }
    // A struct occupies a full storage slot, so its contents need another section.
    return undefined
}
const parseElementaryValue = (
    variable: Variable,
    variableValue: string,
): string | undefined => {
    if (variable.type === 'bool') {
        if (variableValue === '00') return 'false'
        if (variableValue === '01') return 'true'
        throw Error(
            `Failed to parse bool variable "${variable.name}" in slot ${variable.fromSlot}, offset ${variable.byteOffset} and slot value "${variableValue}"`,
        )
    }
    if (variable.type === 'string' || variable.type === 'bytes') {
        if (variable.dynamic) {
            // parseValue returns early when slotValue is not set
            const lastByte = variable.slotValue!.slice(-2)
            const size = BigInt('0x' + lastByte)
            // Check if the last bit is set by AND the size with 0x01
            if ((size & 1n) === 1n) {
                return ((BigInt(variable.slotValue!) - 1n) / 2n).toString()
            }

            // The last byte holds the length of the string or bytes in the slot
            const valueHex = '0x' + variableValue.slice(0, Number(size))
            if (variable.type === 'bytes') return valueHex
            return `\\"${convert2String(valueHex)}\\"`
        }
        if (variable.type === 'bytes') return '0x' + variableValue
        return `\\"${convert2String('0x' + variableValue)}\\"`
    }
    if (variable.type === 'address') {
        return getAddress('0x' + variableValue)
    }
    if (variable.type.match(/^uint([0-9]*)$/)) {
        const parsedValue = BigInt('0x' + variableValue).toString()
        return commify(parsedValue)
    }

    if (variable.type.match(/^bytes([0-9]+)$/)) {
        return '0x' + variableValue
    }
    if (variable.type.match(/^int([0-9]*)/)) {
        let rawValue = BigInt('0x' + variableValue)

        // Elementary int type names end with their optional bit size
        const result = variable.type.match(/^int([0-9]*$)/)!
        const bitSize = result[1] ? Number(result[1]) : 256
        const hexSize = bitSize / 4
        const mask = BigInt('0x80' + '0'.repeat(hexSize - 2))
        const negative = rawValue & mask
        if (negative > 0n) {
            const negativeOne = BigInt('0xFF' + 'F'.repeat(hexSize - 2))
            rawValue = (negativeOne - rawValue + 1n) * -1n
        }
        const parsedValue = rawValue.toString()
        return commify(parsedValue)
    }
    // add fixed point numbers when they are supported by Solidity
    return undefined
}
