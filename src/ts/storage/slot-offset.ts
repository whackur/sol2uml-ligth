import { keccak256, toBeHex, zeroPadValue } from '../utils/evm.js'
import { STORAGE_SLOT_BYTES } from './constants.js'
import type { Variable } from './types.js'

export const calcSectionOffset = (
    variable: Variable,
    sectionOffset = '0',
): string => {
    if (variable.dynamic) {
        // Section-referencing variables come from the parser with slots set
        const hexStringOf32Bytes = zeroPadValue(
            toBeHex(BigInt(variable.fromSlot!) + BigInt(sectionOffset)),
            STORAGE_SLOT_BYTES,
        )
        return keccak256(hexStringOf32Bytes)
    }
    return toBeHex(BigInt(variable.fromSlot!) + BigInt(sectionOffset))
}
