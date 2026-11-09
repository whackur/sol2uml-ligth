import { keccak_256 } from '@noble/hashes/sha3'
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils'

export type BigNumberish = string | number | bigint

const strip0x = (hex: string): string =>
    hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex

const toUnsigned = (value: BigNumberish): bigint => {
    if (value === '') throw Error('Empty numeric value')
    const result = BigInt(value)
    if (result < 0n) throw Error(`Negative value ${value}`)
    return result
}

// Matches ethers v6 toBeHex: even-length lowercase hex, so 0 is 0x00.
export const toBeHex = (value: BigNumberish): string => {
    const hex = toUnsigned(value).toString(16)
    return '0x' + (hex.length % 2 ? '0' + hex : hex)
}

// JSON-RPC quantities have no leading zeros, so 0 is 0x0.
export const toQuantity = (value: BigNumberish): string =>
    '0x' + toUnsigned(value).toString(16)

export const zeroPadValue = (hex: string, bytes: number): string => {
    const digits = strip0x(hex)
    if (!/^([0-9a-fA-F]{2})*$/.test(digits)) {
        throw Error(`Invalid hex data ${hex}`)
    }
    if (digits.length > bytes * 2) {
        throw Error(`Value ${hex} is longer than ${bytes} bytes`)
    }
    return '0x' + digits.padStart(bytes * 2, '0')
}

export const keccak256 = (data: string | Uint8Array): string => {
    const bytes = typeof data === 'string' ? hexToBytes(strip0x(data)) : data
    return '0x' + bytesToHex(keccak_256(bytes))
}

export const keccak256Utf8 = (text: string): string =>
    keccak256(utf8ToBytes(text))

const utf8Decoder = new TextDecoder('utf-8', {
    fatal: true,
    ignoreBOM: true,
})

export const toUtf8String = (hex: string): string =>
    utf8Decoder.decode(hexToBytes(strip0x(hex)))

// EIP-55 checksum. Mixed-case input must already carry a valid checksum.
export const getAddress = (address: string): string => {
    const digits = strip0x(address)
    if (!/^[0-9a-fA-F]{40}$/.test(digits)) {
        throw Error(`Invalid address ${address}`)
    }
    const lower = digits.toLowerCase()
    const hash = bytesToHex(keccak_256(utf8ToBytes(lower)))
    let checksummed = '0x'
    for (let i = 0; i < 40; i++) {
        checksummed +=
            parseInt(hash[i], 16) >= 8 ? lower[i].toUpperCase() : lower[i]
    }
    const isMixedCase = digits !== lower && digits !== digits.toUpperCase()
    if (isMixedCase && '0x' + digits !== checksummed) {
        throw Error(`Bad address checksum ${address}`)
    }
    return checksummed
}
