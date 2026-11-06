import { parseBlockNumber } from '../explorer/block-number.js'

describe('Block number parsing', () => {
    test('uses parseInt semantics for block values', () => {
        expect(parseBlockNumber('123')).toBe(123)
        expect(parseBlockNumber('123abc')).toBe(123)
        expect(Number.isNaN(parseBlockNumber('latest-ish'))).toBe(true)
    })
})
