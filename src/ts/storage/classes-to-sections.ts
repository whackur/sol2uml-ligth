import path from 'path'
import { AttributeType } from '../umlClass.js'
import type { UmlClass } from '../umlClass.js'
import { calcElementaryTypeSize } from './elementary-type-size.js'
import { nextStorageId, nextVariableId } from './identifiers.js'
import { parseStorageSectionFromAttribute } from './storage-section-parser.js'
import { parseVariables } from './variable-parser.js'
import { adjustSlots } from './section-slots.js'
import type { StorageSection, Variable } from './types.js'
import { StorageSectionType } from './types.js'

const debug = require('debug')('sol2uml-light')

export const convertClasses2StorageSections = (
    contractName: string,
    umlClasses: UmlClass[],
    arrayItems: number,
    contractFilename?: string,
    noExpandVariables: string[] = [],
): StorageSection[] => {
    const umlClass = umlClasses.find(({ name, relativePath }) => {
        if (!contractFilename) {
            return name === contractName
        }
        return (
            name === contractName &&
            (relativePath == path.normalize(contractFilename) ||
                path.basename(relativePath) ===
                    path.normalize(contractFilename))
        )
    })
    if (!umlClass) {
        const contractFilenameError = contractFilename
            ? ` in filename "${contractFilename}"`
            : ''
        throw Error(
            `Failed to find contract with name "${contractName}"${contractFilenameError}.\nIs the \`-c --contract <name>\` option correct?`,
        )
    }
    debug(`Found contract "${contractName}" in ${umlClass.absolutePath}`)

    const storageSections: StorageSection[] = []
    const variables = parseVariables(
        umlClass,
        umlClasses,
        [],
        storageSections,
        [],
        false,
        arrayItems,
        noExpandVariables,
        parseStorageSectionFromAttribute,
    )

    storageSections.unshift({
        id: nextStorageId(),
        name: contractName,
        type: StorageSectionType.Contract,
        variables: variables,
        mapping: false,
    })

    adjustSlots(storageSections[0], 0, storageSections)

    return storageSections
}

export const optionStorageVariables = (
    contractName: string,
    slotNames?: { name?: string; offset: string }[],
    slotTypes?: string[],
): Variable[] => {
    if (!slotNames?.length) {
        return []
    }
    // A missing slotTypes throws a TypeError on .length below; kept as-is
    let types = slotTypes as string[]
    if (!types.length) {
        throw Error(
            `The slotTypes option must be used with the slotNames option`,
        )
    }

    if (slotNames.length > 1 && types.length === 1) {
        types = Array(slotNames.length).fill(types[0])
    }

    const variables: Variable[] = []
    slotNames.forEach((slotName, i) => {
        const { size: byteSize, dynamic } = calcElementaryTypeSize(types[i])
        variables.push({
            id: nextVariableId(),
            fromSlot: undefined,
            toSlot: undefined,
            offset: slotName.offset,
            byteSize,
            byteOffset: 0,
            type: types[i],
            attributeType: AttributeType.Elementary,
            dynamic,
            getValue: true,
            displayValue: true,
            name: slotName.name,
            contractName,
            referenceSectionId: undefined,
            enumValues: undefined,
        })
    })
    const sortedVariables = variables.sort((a, b) => {
        if (a.offset! < b.offset!) {
            return -1
        }
        if (a.offset! > b.offset!) {
            return 1
        }
        return 0
    })

    return sortedVariables
}
