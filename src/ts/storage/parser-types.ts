import type { Attribute, UmlClass } from '../umlClass.js'
import type { StorageSection, Variable } from './types.js'

export type ParseStorageSection = (
    attribute: Attribute,
    umlClass: UmlClass,
    otherClasses: readonly UmlClass[],
    storageSections: StorageSection[],
    mapping: boolean,
    arrayItems: number,
    noExpandVariables: string[],
) => { storageSection?: StorageSection; enumValues?: string[] } | undefined

export type ParseVariables = (
    umlClass: UmlClass,
    umlClasses: readonly UmlClass[],
    variables: Variable[],
    storageSections: StorageSection[],
    inheritedContracts: string[],
    mapping: boolean,
    arrayItems: number,
    noExpandVariables: string[],
    parseStorageSection: ParseStorageSection,
) => Variable[]
