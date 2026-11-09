import { convertClass2Dot } from '../diagram/classToDot.js'
import {
    ClassStereotype,
    OperatorStereotype,
    UmlClass,
    Visibility,
} from '../umlClass.js'

describe('class diagram rendering', () => {
    test('keeps class title, visibility groups, and operator formatting', () => {
        const umlClass = new UmlClass({
            name: 'Vault',
            absolutePath: '/contracts/Vault.sol',
            relativePath: 'contracts/Vault.sol',
            stereotype: ClassStereotype.Contract,
        })
        umlClass.id = 7
        umlClass.attributes.push({
            name: 'owner',
            type: 'address',
            visibility: Visibility.Private,
        })
        umlClass.operators.push({
            name: 'deposit',
            type: 'function',
            visibility: Visibility.Public,
            stereotype: OperatorStereotype.Payable,
            parameters: [{ name: 'amount', type: 'uint256' }],
            returnParameters: [{ type: 'bool' }],
        })

        expect(convertClass2Dot(umlClass)).toBe(
            '\n7 [label="{Vault\\ncontracts/Vault.sol| Private:\\l\\ \\ \\ owner: address\\l| Public:\\l\\ \\ \\ \\ \\<\\<payable\\>\\> deposit(amount: uint256): bool\\l}"]',
        )
    })

    test('hides classes and members according to class options', () => {
        const umlClass = new UmlClass({
            name: 'Vault',
            absolutePath: '/contracts/Vault.sol',
            relativePath: 'Vault.sol',
            stereotype: ClassStereotype.Contract,
        })
        umlClass.attributes.push({
            name: 'owner',
            type: 'address',
            visibility: Visibility.Public,
        })
        umlClass.operators.push({
            name: 'deposit',
            type: 'function',
            visibility: Visibility.Public,
            parameters: [],
        })

        expect(
            convertClass2Dot(umlClass, { hideVariables: true }),
        ).not.toContain('owner')
        expect(
            convertClass2Dot(umlClass, { hideFunctions: true }),
        ).not.toContain('deposit')
        const library = new UmlClass({
            name: 'Utility',
            absolutePath: '/contracts/Utility.sol',
            relativePath: 'Utility.sol',
            stereotype: ClassStereotype.Library,
        })
        expect(convertClass2Dot(library, { hideLibraries: true })).toBe('')
    })
})
