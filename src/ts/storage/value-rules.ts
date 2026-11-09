import { AttributeType } from '../umlClass.js'
import { StorageSectionType } from './types.js'

export const calcDisplayValue = (
    attributeType: AttributeType | undefined,
    dynamic: boolean,
    mapping: boolean,
    storageSectionType?: StorageSectionType,
): boolean =>
    mapping === false &&
    (attributeType === AttributeType.Elementary ||
        (attributeType === AttributeType.UserDefined &&
            storageSectionType !== StorageSectionType.Struct) ||
        (attributeType === AttributeType.Array && dynamic))

export const calcGetValue = (
    attributeType: AttributeType | undefined,
    mapping: boolean,
): boolean => mapping === false && attributeType !== AttributeType.Mapping
