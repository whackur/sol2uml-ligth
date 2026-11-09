import { parse } from '@solidity-parser/parser'
import { convertAST2UmlClasses } from '../converterAST2Classes.js'
import { squashUmlClasses } from '../classes/squash.js'
import { optionStorageVariables } from '../storage/classes-to-sections.js'
import { parseSolidityVersion } from '../explorer/solidity-version.js'
import { OperatorStereotype, UmlClass } from '../umlClass.js'

const toClasses = (source: string): UmlClass[] =>
    convertAST2UmlClasses(parse(source), 'Test.sol', [])

const byName = (classes: UmlClass[], name: string): UmlClass =>
    classes.find((c) => c.name === name)!

describe('receive and fallback functions', () => {
    test('are named and get their stereotypes', () => {
        const [umlClass] = toClasses(`
            contract A {
                receive() external payable {}
                fallback() external {}
            }`)

        expect(umlClass.operators.map((o) => [o.name, o.stereotype])).toEqual([
            ['receive', OperatorStereotype.Payable],
            ['fallback', OperatorStereotype.Fallback],
        ])
    })
})

describe('using for with a function list', () => {
    test('links the libraries of qualified functions and skips free functions', () => {
        const [umlClass] = toClasses(`
            contract A {
                using {L.add, L.sub, M.mul, free} for uint256;
            }`)

        expect(Object.keys(umlClass.associations).sort()).toEqual(['L', 'M'])
    })
})

describe('squashed overrides', () => {
    test('keep the most derived implementation', () => {
        const classes = toClasses(`
            contract Base { function f() public virtual {} }
            contract Middle is Base { function f() public virtual override {} }
            contract Child is Middle { function f() public override {} }
            contract Other { function g() public {} }`)

        const squashed = squashUmlClasses(classes, ['Child'])
        const child = byName(squashed, 'Child')
        const f = child.operators.filter((o) => o.name === 'f')

        expect(f).toHaveLength(1)
        expect(f[0].sourceContract).toBe('Child')
    })
})

describe('input validation errors', () => {
    test('reject slot names without slot types with the intended message', () => {
        expect(() =>
            optionStorageVariables('A', [{ name: 'x', offset: '0x01' }]),
        ).toThrow('The slotTypes option must be used with the slotNames option')
    })

    test('reject an unparseable compiler version with the intended message', () => {
        expect(() => parseSolidityVersion('unknown')).toThrow(
            'Failed to parse compiler version unknown',
        )
    })
})
