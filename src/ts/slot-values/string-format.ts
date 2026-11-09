import { toUtf8String } from '../utils/evm.js'
import { STORAGE_SLOT_HEX_LENGTH } from '../storage/constants.js'

const ZERO_STORAGE_SLOT = `0x${'0'.repeat(STORAGE_SLOT_HEX_LENGTH)}`

export const convert2String = (bytes: string): string => {
    if (bytes === ZERO_STORAGE_SLOT) return ''
    const rawString = toUtf8String(bytes)
    return escapeString(rawString)
}

export const escapeString = (text: string): string => {
    return text.replace(/(?=[<>&"])/g, '\\')
}
