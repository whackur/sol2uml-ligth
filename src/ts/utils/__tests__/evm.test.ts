import {
    getAddress,
    keccak256Utf8,
    toBeHex,
    toQuantity,
    toUtf8String,
    zeroPadValue,
} from '../evm.js'

describe('EVM helpers', () => {
    test('formats hex like the JSON-RPC and storage callers expect', () => {
        expect(toBeHex(0n)).toBe('0x00')
        expect(toBeHex(256n)).toBe('0x0100')
        expect(toQuantity(0n)).toBe('0x0')
        expect(toQuantity(12)).toBe('0xc')
        expect(zeroPadValue('0x01', 2)).toBe('0x0001')
        expect(() => zeroPadValue('0x010203', 2)).toThrow()
        expect(() => zeroPadValue('0xzz', 2)).toThrow()
        expect(() => toBeHex(-1n)).toThrow()
        expect(() => toQuantity('')).toThrow()
    })

    test('hashes UTF-8 text with keccak256', () => {
        expect(keccak256Utf8('eip1967.proxy.implementation')).toBe(
            '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbd',
        )
    })

    test('applies and validates EIP-55 checksums', () => {
        expect(getAddress('0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed')).toBe(
            '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
        )
        expect(() =>
            getAddress('0x5aAeb6053f3e94c9b9a09f33669435e7ef1beaed'),
        ).toThrow(/checksum/)
    })

    test('rejects invalid UTF-8', () => {
        expect(toUtf8String('0x61626364')).toBe('abcd')
        expect(toUtf8String('0xefbbbf61')).toBe('\ufeffa')
        expect(() => toUtf8String('0xff')).toThrow()
    })
})
