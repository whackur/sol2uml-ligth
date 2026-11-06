import { AttributeType } from '../umlClass.js'
import type { BigNumberish } from 'ethers'
import { addSlotValues } from '../slot-values/add-slot-values.js'
import { dynamicSlotSize } from '../slot-values/dynamic-slot-size.js'
import { addArrayVariables } from './array-variables.js'
import { STORAGE_SLOT_BYTES } from './constants.js'
import { nextStorageId, nextVariableId } from './identifiers.js'
import { calcSectionOffset } from './slot-offset.js'
import type { StorageSection, Variable } from './types.js'
import { StorageSectionType } from './types.js'

const debug = require('debug')('sol2uml-light')

export const addDynamicVariables = async (
    storageSection: StorageSection,
    storageSections: StorageSection[],
    url: string,
    contractAddress: string,
    arrayItems: number,
    blockTag: BigNumberish,
) => {
    for (const variable of storageSection.variables) {
        try {
            if (!variable.dynamic) continue
            if (variable.type === 'string' || variable.type === 'bytes') {
                if (!variable.slotValue) {
                    debug(
                        `WARNING: Variable "${variable.name}" of type "${variable.type}" has no slot value`,
                    )
                    continue
                }
                const size = dynamicSlotSize(variable)
                if (size > STORAGE_SLOT_BYTES - 1) {
                    const maxSlotNumber = Math.floor(
                        (size - 1) / STORAGE_SLOT_BYTES,
                    )
                    const variables: Variable[] = []

                    for (let i = 0; i <= maxSlotNumber; i++) {
                        const byteSize =
                            i === maxSlotNumber
                                ? size - STORAGE_SLOT_BYTES * maxSlotNumber
                                : STORAGE_SLOT_BYTES
                        variables.push({
                            id: nextVariableId(),
                            fromSlot: i,
                            toSlot: i,
                            byteSize,
                            byteOffset: 0,
                            type: variable.type,
                            contractName: variable.contractName,
                            attributeType: AttributeType.Elementary,
                            dynamic: false,
                            getValue: true,
                            displayValue: true,
                        })
                    }

                    const unusedBytes =
                        STORAGE_SLOT_BYTES -
                        (size - STORAGE_SLOT_BYTES * maxSlotNumber)
                    if (unusedBytes > 0) {
                        const lastVariable = variables[variables.length - 1]
                        variables.push({
                            ...lastVariable,
                            byteOffset: unusedBytes,
                        })

                        variables[maxSlotNumber] = {
                            id: nextVariableId(),
                            fromSlot: maxSlotNumber,
                            toSlot: maxSlotNumber,
                            byteSize: unusedBytes,
                            byteOffset: 0,
                            type: 'unallocated',
                            attributeType: AttributeType.UserDefined,
                            contractName: variable.contractName,
                            name: '',
                            dynamic: false,
                            getValue: true,
                            displayValue: false,
                        }
                    }

                    const newStorageSection: StorageSection = {
                        id: nextStorageId(),
                        name: `${variable.type}: ${variable.name}`,
                        offset: calcSectionOffset(
                            variable,
                            storageSection.offset,
                        ),
                        type:
                            variable.type === 'string'
                                ? StorageSectionType.String
                                : StorageSectionType.Bytes,
                        arrayDynamic: true,
                        arrayLength: size,
                        variables,
                        mapping: false,
                    }
                    variable.referenceSectionId = newStorageSection.id

                    await addSlotValues(
                        url,
                        contractAddress,
                        newStorageSection,
                        arrayItems,
                        blockTag,
                    )

                    storageSections.push(newStorageSection)
                }

                continue
            }
            if (variable.attributeType !== AttributeType.Array) continue

            const referenceStorageSection = storageSections.find(
                (ss) => ss.id === variable.referenceSectionId,
            )
            if (!referenceStorageSection) continue

            await addDynamicVariables(
                referenceStorageSection,
                storageSections,
                url,
                contractAddress,
                arrayItems,
                blockTag,
            )

            if (!variable.slotValue) {
                debug(
                    `WARNING: Dynamic array variable "${variable.name}" of type "${variable.type}" has no slot value`,
                )
                continue
            }

            const arrayLength = Number(BigInt(variable.slotValue))
            if (arrayLength > 1) {
                addArrayVariables(
                    arrayLength,
                    arrayItems,
                    referenceStorageSection.variables,
                )
            }

            await addSlotValues(
                url,
                contractAddress,
                referenceStorageSection,
                arrayItems,
                blockTag,
            )
        } catch (err) {
            throw Error(
                `Failed to add dynamic vars for section "${storageSection.name}", var type "${variable.type}" with value "${variable.slotValue}" from slot ${variable.fromSlot} and section offset ${storageSection.offset}`,
                { cause: err },
            )
        }
    }
}
