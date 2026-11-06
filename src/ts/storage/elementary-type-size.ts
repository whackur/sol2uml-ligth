import { BITS_PER_BYTE, STORAGE_SLOT_BYTES } from './constants.js'

export const calcElementaryTypeSize = (
    type: string,
): { size: number; dynamic: boolean } => {
    switch (type) {
        case 'bool':
            return { size: 1, dynamic: false }
        case 'address':
            return { size: 20, dynamic: false }
        case 'string':
        case 'bytes':
            return { size: STORAGE_SLOT_BYTES, dynamic: true }
        case 'uint':
        case 'int':
        case 'ufixed':
        case 'fixed':
            return { size: STORAGE_SLOT_BYTES, dynamic: false }
        default: {
            const result = type.match(/[u]*(int|fixed|bytes)([0-9]+)/)
            if (result === null || !result[2]) {
                throw Error(`Failed size elementary type "${type}"`)
            }
            if (result[1] === 'bytes') {
                return { size: parseInt(result[2]), dynamic: false }
            }
            // TODO need to handle fixed types when they are supported

            const bitSize = parseInt(result[2])
            return { size: bitSize / BITS_PER_BYTE, dynamic: false }
        }
    }
}

export const isElementary = (type: string): boolean => {
    switch (type) {
        case 'bool':
        case 'address':
        case 'string':
        case 'bytes':
        case 'uint':
        case 'int':
        case 'ufixed':
        case 'fixed':
            return true
        default: {
            const result = type.match(/^[u]?(int|fixed|bytes)([0-9]+)$/)
            return result !== null
        }
    }
}
