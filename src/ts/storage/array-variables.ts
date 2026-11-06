import { AttributeType } from '../umlClass.js'
import { parseValue } from '../slot-values/value-decoding.js'
import { STORAGE_SLOT_BYTES } from './constants.js'
import { nextVariableId } from './identifiers.js'
import type { Variable } from './types.js'

export const addArrayVariables = (
    arrayLength: number,
    arrayItems: number,
    variables: Variable[],
) => {
    const arraySlotSize = variables[0].byteSize
    const itemsPerSlot = Math.floor(STORAGE_SLOT_BYTES / arraySlotSize)
    const slotsPerItem = Math.ceil(arraySlotSize / STORAGE_SLOT_BYTES)
    const firstFillerItem =
        itemsPerSlot > 0 ? arrayItems * itemsPerSlot : arrayItems
    const lastFillerItem =
        itemsPerSlot > 0
            ? arrayLength -
              (arrayItems - 1) * itemsPerSlot - // the number of items in all but the last row
              (arrayLength % itemsPerSlot || itemsPerSlot) - // the remaining items in the last row or all the items in a slot
              1 // need the items before the last three rows
            : arrayLength - arrayItems - 1

    for (let i = 1; i < arrayLength; i++) {
        const fromSlot =
            itemsPerSlot > 0 ? Math.floor(i / itemsPerSlot) : i * slotsPerItem
        const toSlot = itemsPerSlot > 0 ? fromSlot : fromSlot + slotsPerItem

        // Keep a filler covering the omitted middle of a long array.
        if (i === lastFillerItem && firstFillerItem < lastFillerItem) {
            const fillerFromSlot =
                itemsPerSlot > 0
                    ? Math.floor(firstFillerItem / itemsPerSlot)
                    : firstFillerItem * slotsPerItem
            variables.push({
                id: nextVariableId(),
                attributeType: AttributeType.UserDefined,
                type: '----',
                fromSlot: fillerFromSlot,
                toSlot: toSlot,
                byteOffset: 0,
                byteSize: (toSlot - fillerFromSlot + 1) * STORAGE_SLOT_BYTES,
                getValue: false,
                displayValue: false,
                dynamic: false,
            })
        }
        // Display only the first and last groups when the array is long.
        if (i < firstFillerItem || i > lastFillerItem) {
            const byteOffset =
                itemsPerSlot > 0 ? (i % itemsPerSlot) * arraySlotSize : 0
            const slotValue =
                fromSlot === 0 ? variables[0].slotValue : undefined
            const newVariable: Variable = {
                ...variables[0],
                id: nextVariableId(),
                fromSlot,
                toSlot,
                byteOffset,
                slotValue,
                parsedValue: undefined,
                referenceSectionId: undefined,
                enumValues: undefined,
            }
            newVariable.parsedValue = parseValue(newVariable)
            variables.push(newVariable)
        }
    }
}
