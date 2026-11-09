import { AttributeType } from '../umlClass.js'
import { calcSectionOffset } from './slot-offset.js'
import type { StorageSection } from './types.js'

export const adjustSlots = (
    storageSection: StorageSection,
    slotOffset: number,
    storageSections: StorageSection[],
) => {
    storageSection.variables.forEach((variable) => {
        // Section variables come from the parser with slots set
        variable.fromSlot! += slotOffset
        variable.toSlot! += slotOffset

        const referenceStorageSection = storageSections.find(
            (ss) => ss.id === variable.referenceSectionId,
        )

        if (referenceStorageSection) {
            referenceStorageSection.offset = storageSection.offset

            if (!variable.dynamic) {
                adjustSlots(
                    referenceStorageSection,
                    variable.fromSlot!,
                    storageSections,
                )
            } else if (variable.attributeType === AttributeType.Array) {
                // Dynamic array sections start at the hash of their declaration slot.
                referenceStorageSection.offset = calcSectionOffset(
                    variable,
                    storageSection.offset,
                )

                adjustSlots(referenceStorageSection, 0, storageSections)
            }
        }
    })
}
