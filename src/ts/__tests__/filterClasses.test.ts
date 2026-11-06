import {
    classesConnectedToBaseContracts,
    filterHiddenClasses,
    topologicalSortClasses,
} from '../filterClasses.js'
import { ClassStereotype, ReferenceType, UmlClass } from '../umlClass.js'

const initialIdCounter = UmlClass.idCounter

const createClass = (
    name: string,
    stereotype: ClassStereotype = ClassStereotype.Contract,
    absolutePath = '/contracts/test.sol',
): UmlClass =>
    new UmlClass({
        name,
        absolutePath,
        relativePath: 'test.sol',
        stereotype,
    })

const addAssociation = (source: UmlClass, targetName: string): void => {
    source.addAssociation({
        targetUmlClassName: targetName,
        referenceType: ReferenceType.Memory,
    })
}

afterEach(() => {
    UmlClass.idCounter = initialIdCounter
})

describe('filterClasses', () => {
    test('filters connected classes by depth across multiple bases and skips unresolved associations', () => {
        const base = createClass('Base')
        const middle = createClass('Middle')
        const leaf = createClass('Leaf')
        const otherBase = createClass('OtherBase')

        addAssociation(base, middle.name)
        addAssociation(middle, leaf.name)
        addAssociation(otherBase, 'MissingType')

        const classes = [base, middle, leaf, otherBase]

        expect(
            classesConnectedToBaseContracts(
                classes,
                ['Base', 'OtherBase'],
                1,
            ).map(({ name }) => name),
        ).toEqual(['Base', 'Middle', 'OtherBase'])
        expect(
            classesConnectedToBaseContracts(classes, ['Base']).map(
                ({ name }) => name,
            ),
        ).toEqual(['Base', 'Middle', 'Leaf'])
    })

    test('preserves the missing base contract error', () => {
        const classes = [createClass('Present')]

        expect(() =>
            classesConnectedToBaseContracts(classes, ['Missing']),
        ).toThrow('Failed to find base contract with name "Missing"')
    })

    test('keeps the last same-name class in its original result position across bases', () => {
        const baseOne = createClass(
            'BaseOne',
            ClassStereotype.Contract,
            '/one.sol',
        )
        const firstShared = createClass(
            'Shared',
            ClassStereotype.Contract,
            '/one.sol',
        )
        const baseTwo = createClass(
            'BaseTwo',
            ClassStereotype.Contract,
            '/two.sol',
        )
        const secondShared = createClass(
            'Shared',
            ClassStereotype.Contract,
            '/two.sol',
        )

        addAssociation(baseOne, 'Shared')
        addAssociation(baseTwo, 'Shared')

        expect(
            classesConnectedToBaseContracts(
                [baseOne, firstShared, baseTwo, secondShared],
                ['BaseOne', 'BaseTwo'],
                1,
            ),
        ).toEqual([baseOne, secondShared, baseTwo])
    })

    test('omits hidden stereotypes and import classes', () => {
        const classes = [
            createClass('Contract'),
            createClass('Abstract', ClassStereotype.Abstract),
            createClass('Interface', ClassStereotype.Interface),
            createClass('Library', ClassStereotype.Library),
            createClass('Struct', ClassStereotype.Struct),
            createClass('Enum', ClassStereotype.Enum),
            createClass('Constant', ClassStereotype.Constant),
            createClass('Import', ClassStereotype.Import),
        ]

        expect(
            filterHiddenClasses(classes, {
                hideAbstracts: true,
                hideInterfaces: true,
                hideLibraries: true,
                hideStructs: true,
                hideEnums: true,
                hideConstants: true,
                hideContracts: true,
            }),
        ).toEqual([])
        expect(
            filterHiddenClasses(classes, {}).map(({ name }) => name),
        ).toEqual(classes.slice(0, -1).map(({ name }) => name))
    })

    test('sorts sparse class IDs by dependency and keeps first-match ID lookup', () => {
        const source = createClass('Source')
        const dependency = createClass('Dependency')
        const unrelated = createClass('Unrelated')
        const firstForDuplicateId = createClass('FirstForDuplicateId')
        const secondForDuplicateId = createClass('SecondForDuplicateId')

        source.id = initialIdCounter + 8
        dependency.id = initialIdCounter + 2
        unrelated.id = initialIdCounter + 5
        firstForDuplicateId.id = initialIdCounter + 3
        secondForDuplicateId.id = firstForDuplicateId.id
        UmlClass.idCounter = initialIdCounter + 9
        addAssociation(source, dependency.name)

        const classes = [
            source,
            unrelated,
            dependency,
            firstForDuplicateId,
            secondForDuplicateId,
        ]
        const sorted = topologicalSortClasses(classes)

        expect(sorted).toHaveLength(4)
        expect(sorted).toEqual(
            expect.arrayContaining([
                source,
                dependency,
                unrelated,
                firstForDuplicateId,
            ]),
        )
        expect(sorted.indexOf(dependency)).toBeLessThan(sorted.indexOf(source))
        expect(sorted).not.toContain(secondForDuplicateId)
        expect(sorted).not.toContain(undefined)
    })
})
