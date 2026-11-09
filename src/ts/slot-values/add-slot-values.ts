import type { BigNumberish } from '../utils/evm.js'
import { AttributeType } from '../umlClass.js'
import { getSlotValues } from './rpc.js'
import { parseValue } from './value-decoding.js'
import type { StorageSection } from '../storage/types.js'

const debug = require('debug')('sol2uml-light')

export const addSlotValues = async (
    url: string,
    contractAddress: string,
    storageSection: StorageSection,
    arrayItems: number,
    blockTag: BigNumberish,
) => {
    const valueVariables = storageSection.variables.filter(
        (variable) => variable.getValue && !variable.slotValue,
    )
    if (valueVariables.length === 0) return

    const slots: BigNumberish[] = []
    valueVariables.forEach((variable) => {
        if (variable.offset) {
            slots.push(BigInt(variable.offset))
        } else {
            // Variables without an offset come from the parser with slots set
            for (let i = 0; variable.fromSlot! + i <= variable.toSlot!; i++) {
                if (
                    variable.attributeType === AttributeType.Array &&
                    i >= arrayItems &&
                    i < variable.toSlot! - arrayItems
                ) {
                    continue
                }
                slots.push(variable.fromSlot! + i)
            }
        }
    })
    const uniqueFromSlots = [...new Set(slots)]

    const slotKeys = uniqueFromSlots.map((fromSlot) => {
        if (storageSection.offset) {
            return BigInt(storageSection.offset) + BigInt(fromSlot)
        }
        return BigInt(fromSlot)
    })

    const values = await getSlotValues(url, contractAddress, slotKeys, blockTag)

    values.forEach((value, i) => {
        const fromSlot = uniqueFromSlots[i]

        for (const variable of storageSection.variables) {
            if (
                variable.getValue &&
                variable.offset &&
                BigInt(variable.offset) === BigInt(fromSlot)
            ) {
                debug(
                    `Set slot value ${value} for section "${storageSection.name}", var type ${variable.type}, slot ${variable.offset}`,
                )
                variable.slotValue = value
                if (variable.displayValue) {
                    variable.parsedValue = parseValue(variable)
                }
            } else if (variable.getValue && variable.fromSlot === fromSlot) {
                debug(
                    `Set slot value ${value} for section "${storageSection.name}", var type ${variable.type}, slot ${variable.fromSlot} offset ${storageSection.offset}`,
                )
                variable.slotValue = value
                if (variable.displayValue) {
                    variable.parsedValue = parseValue(variable)
                }
            } else if (
                variable.toSlot &&
                BigInt(variable.toSlot) > BigInt(fromSlot)
            ) {
                // Variables are ordered by slot, so later ones cannot match this value.
                break
            }
        }
    })
}
