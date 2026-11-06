import type { AttributeType } from '../umlClass.js'

export enum StorageSectionType {
    Contract = 'Contract',
    Struct = 'Struct',
    Array = 'Array',
    Bytes = 'Bytes',
    String = 'String',
}

export interface Variable {
    id: number
    fromSlot?: number
    toSlot?: number
    offset?: string
    byteSize: number
    byteOffset: number
    type: string
    attributeType: AttributeType
    dynamic: boolean
    name?: string
    contractName?: string
    displayValue: boolean
    getValue?: boolean
    slotValue?: string
    parsedValue?: string
    referenceSectionId?: number
    enumValues?: string[]
}

export interface StorageSection {
    id: number
    name: string
    address?: string
    offset?: string
    type: StorageSectionType
    arrayLength?: number
    arrayDynamic?: boolean
    mapping: boolean // is referenced from a mapping
    variables: Variable[]
}
