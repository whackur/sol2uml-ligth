import { findAssociatedClass } from '../classes/associations.js'
import { ClassStereotype, ReferenceType, UmlClass } from '../umlClass.js'

const makeClass = (
    name: string,
    absolutePath = '/project/Source.sol',
    parentId?: number,
): UmlClass =>
    new UmlClass({
        name,
        absolutePath,
        relativePath: absolutePath,
        parentId,
    })

const addNestedType = (
    owner: UmlClass,
    name: string,
    stereotype = ClassStereotype.Struct,
    id?: number,
): UmlClass => {
    const nested = makeClass(name, owner.absolutePath, owner.id)
    if (id !== undefined) {
        nested.id = id
        UmlClass.idCounter = Math.max(UmlClass.idCounter, id + 1)
    }
    if (stereotype === ClassStereotype.Enum) owner.enums.push(nested.id)
    else owner.structs.push(nested.id)
    return nested
}

const associate = (
    targetUmlClassName: string,
    parentUmlClassName?: string,
) => ({
    referenceType: ReferenceType.Storage,
    targetUmlClassName,
    parentUmlClassName,
})

const inherits = (child: UmlClass, parentName: string) => {
    child.addAssociation({
        referenceType: ReferenceType.Storage,
        targetUmlClassName: parentName,
        realization: true,
    })
}

describe('findAssociatedClass', () => {
    test('resolves qualified nested types with sparse IDs and reordered classes', () => {
        const source = makeClass('Source')
        const owner = makeClass('Owner')
        owner.id = 720
        UmlClass.idCounter = Math.max(UmlClass.idCounter, owner.id + 1)
        const nested = addNestedType(
            owner,
            'Detail',
            ClassStereotype.Struct,
            911,
        )

        const result = findAssociatedClass(
            associate('Detail', 'Owner'),
            source,
            [nested, source, owner],
        )

        expect(result).toBe(nested)
    })

    test('resolves an aliased owner without choosing an earlier same-file name', () => {
        const source = makeClass('Source', '/project/Source.sol')
        const wrong = makeClass('Wrong', '/project/Defs.sol')
        const right = makeClass('Right', '/project/Defs.sol')
        const expected = addNestedType(right, 'Detail')
        source.imports = [
            {
                absolutePath: '/project/Defs.sol',
                classNames: [{ className: 'Right', alias: 'Alias' }],
            },
        ]

        expect(
            findAssociatedClass(associate('Detail', 'Alias'), source, [
                wrong,
                expected,
                right,
                source,
            ]),
        ).toBe(expected)
    })

    test('resolves qualified owners through multiple aliased imports', () => {
        const source = makeClass('Source', '/project/Source.sol')
        const barrel = makeClass('Barrel', '/project/Barrel.sol')
        const wrong = makeClass('Wrong', '/project/Defs.sol')
        const right = makeClass('Right', '/project/Defs.sol')
        const expected = addNestedType(right, 'Detail')
        source.imports = [
            {
                absolutePath: barrel.absolutePath,
                classNames: [{ className: 'Renamed', alias: 'Alias' }],
            },
        ]
        barrel.imports = [
            {
                absolutePath: right.absolutePath,
                classNames: [{ className: 'Right', alias: 'Renamed' }],
            },
        ]

        expect(
            findAssociatedClass(associate('Detail', 'Alias'), source, [
                source,
                barrel,
                wrong,
                expected,
                right,
            ]),
        ).toBe(expected)
    })

    test('resolves qualified nested types inherited by the selected owner', () => {
        const base = makeClass('Base')
        const expected = addNestedType(base, 'Detail')
        const derived = makeClass('Derived')
        inherits(derived, 'Base')
        const source = makeClass('Source')
        source.imports = [
            {
                absolutePath: derived.absolutePath,
                classNames: [{ className: 'Derived' }],
            },
        ]

        expect(
            findAssociatedClass(associate('Detail', 'Derived'), source, [
                expected,
                source,
                derived,
                base,
            ]),
        ).toBe(expected)
    })

    test('resolves imported parents with identical names by their import paths', () => {
        const source = makeClass('Source', '/project/Source.sol')
        const first = makeClass('Parent', '/project/one/Parent.sol')
        const second = makeClass('Parent', '/project/two/Parent.sol')
        const firstNested = addNestedType(first, 'Detail')
        const secondNested = addNestedType(second, 'Detail')
        source.imports = [
            {
                absolutePath: first.absolutePath,
                classNames: [{ className: 'Parent', alias: 'First' }],
            },
            {
                absolutePath: second.absolutePath,
                classNames: [{ className: 'Parent', alias: 'Second' }],
            },
        ]

        expect(
            findAssociatedClass(associate('Detail', 'Second'), source, [
                firstNested,
                secondNested,
                first,
                second,
                source,
            ]),
        ).toBe(secondNested)
    })

    test('resolves an unqualified nested type only in its lexical ancestry', () => {
        const base = makeClass('Base')
        const baseStruct = addNestedType(base, 'Shared')
        const baseEnum = addNestedType(base, 'Mode', ClassStereotype.Enum)
        const other = makeClass('Other')
        const unrelatedStruct = addNestedType(other, 'Shared')
        const unrelatedEnum = addNestedType(other, 'Mode', ClassStereotype.Enum)
        const use = makeClass('Use')
        inherits(use, 'Base')

        const classes = [
            unrelatedStruct,
            other,
            unrelatedEnum,
            use,
            baseEnum,
            base,
            baseStruct,
        ]

        expect(findAssociatedClass(associate('Shared'), use, classes)).toBe(
            baseStruct,
        )
        expect(findAssociatedClass(associate('Mode'), use, classes)).toBe(
            baseEnum,
        )
    })

    test('does not fall back to a same-named nested type for a missing qualifier', () => {
        const base = makeClass('Base')
        const nested = addNestedType(base, 'Detail')
        const source = makeClass('Source')
        inherits(source, 'Base')

        expect(
            findAssociatedClass(associate('Detail', 'Missing'), source, [
                nested,
                source,
                base,
            ]),
        ).toBeUndefined()
    })

    test('terminates for missing types and bases with circular imports', () => {
        const first = makeClass('First', '/project/First.sol')
        const second = makeClass('Second', '/project/Second.sol')
        first.imports = [{ absolutePath: second.absolutePath, classNames: [] }]
        second.imports = [{ absolutePath: first.absolutePath, classNames: [] }]
        inherits(first, 'MissingBase')

        expect(
            findAssociatedClass(associate('MissingType'), first, [
                first,
                second,
            ]),
        ).toBeUndefined()
    })

    test('keeps the first parent branch in cyclic diamond inheritance', () => {
        const root = makeClass('Root')
        const first = makeClass('First')
        const second = makeClass('Second')
        const firstType = addNestedType(first, 'Shared')
        addNestedType(second, 'Shared')
        inherits(root, 'First')
        inherits(root, 'Second')
        inherits(first, 'Root')
        inherits(second, 'Root')

        expect(
            findAssociatedClass(associate('Shared'), root, [
                root,
                first,
                second,
                firstType,
            ]),
        ).toBe(firstType)
    })

    test('handles a 5500-level inheritance chain for a missing type', () => {
        const classes = Array.from({ length: 5500 }, (_, index) =>
            makeClass(`Contract${index}`),
        )
        for (let index = 1; index < classes.length; index++) {
            inherits(classes[index], classes[index - 1].name)
        }

        expect(
            findAssociatedClass(
                associate('MissingType'),
                classes[classes.length - 1],
                classes,
            ),
        ).toBeUndefined()
    })

    test('resolves imported top-level classes through aliases and barrels', () => {
        const source = makeClass('Source', '/project/Source.sol')
        const barrel = makeClass('Barrel', '/project/Barrel.sol')
        const target = makeClass('Target', '/project/Target.sol')
        source.imports = [
            {
                absolutePath: barrel.absolutePath,
                classNames: [{ className: 'Renamed', alias: 'Alias' }],
            },
        ]
        barrel.imports = [
            {
                absolutePath: target.absolutePath,
                classNames: [{ className: 'Target', alias: 'Renamed' }],
            },
        ]

        expect(
            findAssociatedClass(associate('Alias'), source, [
                source,
                barrel,
                target,
            ]),
        ).toBe(target)
    })

    test('keeps realization lookup on the top-level contract', () => {
        const source = makeClass('Derived')
        const nestedType = addNestedType(source, 'Base')
        const base = makeClass('Base')
        base.stereotype = ClassStereotype.Contract

        expect(
            findAssociatedClass(
                { ...associate('Base'), realization: true },
                source,
                [nestedType, source, base],
            ),
        ).toBe(base)
    })

    test('resolves direct top-level imports', () => {
        const source = makeClass('Source', '/project/Source.sol')
        const target = makeClass('Target', '/project/Target.sol')
        source.imports = [
            {
                absolutePath: target.absolutePath,
                classNames: [{ className: 'Target' }],
            },
        ]

        expect(
            findAssociatedClass(associate('Target'), source, [source, target]),
        ).toBe(target)
    })
})
