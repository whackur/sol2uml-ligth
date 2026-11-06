import { UmlClass } from '../umlClass.js'

describe('UmlClass compatibility facade', () => {
    test('preserves the public id counter and allocation order', () => {
        const start = UmlClass.idCounter

        const first = new UmlClass({
            name: 'First',
            absolutePath: '/contracts/First.sol',
            relativePath: 'First.sol',
        })
        const second = new UmlClass({
            name: 'Second',
            absolutePath: '/contracts/Second.sol',
            relativePath: 'Second.sol',
        })

        expect(first.id).toBe(start)
        expect(second.id).toBe(start + 1)
        expect(UmlClass.idCounter).toBe(start + 2)
        UmlClass.idCounter = start
    })
})
