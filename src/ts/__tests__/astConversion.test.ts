import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { parse } from '@solidity-parser/parser'
import { convertAST2UmlClasses } from '../converterAST2Classes.js'
import {
    AttributeType,
    ClassStereotype,
    ReferenceType,
    UmlClass,
} from '../umlClass.js'
import { parseRemapping } from '../imports/remappings.js'

describe('AST to UML conversion', () => {
    test('retains declarations, remapped aliases, and library call associations', () => {
        const source = `
            pragma solidity 0.8.38;
            import {Library as ExternalLibrary} from "@math/Library.sol";

            struct FileStruct { address account; }
            enum FileState { Ready, Done }
            uint256 constant FILE_COUNT = 3;

            contract Sample {
                struct Detail { uint256 amount; }
                enum Status { New, Complete }
                FileStruct public fileData;

                function callLibrary(uint256 value) public returns (uint256) {
                    return ExternalLibrary.double(value);
                }
            }
        `
        const node = parse(source, {})
        const classes = convertAST2UmlClasses(node, 'src/Sample.sol', [
            parseRemapping('@math/=lib/math/'),
        ])

        const sample = classes.find((umlClass) => umlClass.name === 'Sample')!
        const fileStruct = classes.find(
            (umlClass) => umlClass.name === 'FileStruct',
        )!
        const fileState = classes.find(
            (umlClass) => umlClass.name === 'FileState',
        )!
        const fileCount = classes.find(
            (umlClass) => umlClass.name === 'FILE_COUNT',
        )!

        expect(fileStruct.stereotype).toBe(ClassStereotype.Struct)
        expect(fileStruct.attributes).toEqual([
            {
                name: 'account',
                type: 'address',
                attributeType: AttributeType.Elementary,
            },
        ])
        expect(fileState.attributes).toEqual([
            { name: 'Ready', type: '0' },
            { name: 'Done', type: '1' },
        ])
        expect(fileCount.constants).toEqual([{ name: 'FILE_COUNT', value: 3 }])

        expect(sample.associations.FileStruct).toMatchObject({
            referenceType: ReferenceType.Storage,
            targetUmlClassName: 'FileStruct',
        })
        expect(sample.associations.ExternalLibrary).toMatchObject({
            referenceType: ReferenceType.Memory,
            targetUmlClassName: 'ExternalLibrary',
            functionsCalled: ['double'],
        })
        expect(sample.memberAccessCalls).toEqual(new Set(['double']))
        expect(sample.structs).toHaveLength(1)
        expect(sample.enums).toHaveLength(1)

        expect(
            classes.every((umlClass) => umlClass.imports === sample.imports),
        ).toBe(true)
        expect(sample.imports).toEqual([
            {
                absolutePath: 'lib/math/Library.sol',
                classNames: [
                    { className: 'Library', alias: 'ExternalLibrary' },
                ],
            },
        ])
    })

    test('keeps import-only source units represented by an import class', () => {
        const idBeforeConversion = UmlClass.idCounter
        const node = parse(
            'import {Thing as LocalThing} from "./Thing.sol";',
            {},
        )
        const classes = convertAST2UmlClasses(node, 'src/Consumer.sol', [])

        expect(classes).toHaveLength(1)
        expect(classes[0].id).toBe(idBeforeConversion)
        expect(UmlClass.idCounter).toBe(idBeforeConversion + 1)
        expect(classes[0].name).toBe('Import')
        expect(classes[0].stereotype).toBe(ClassStereotype.Import)
        expect(classes[0].imports).toEqual([
            {
                absolutePath: 'src/Thing.sol',
                classNames: [{ className: 'Thing', alias: 'LocalThing' }],
            },
        ])
    })

    test('qualifies nested user types inside mappings and recursive arrays', () => {
        const node = parse(
            `
                pragma solidity 0.8.38;
                contract Definitions {
                    struct Detail { uint256 amount; }
                }
                contract Consumer {
                    mapping(uint256 => Definitions.Detail) records;
                    Definitions.Detail[] items;
                    Definitions.Detail[][] matrix;
                }
            `,
            {},
        )
        const classes = convertAST2UmlClasses(node, 'src/Containers.sol', [])
        const consumer = classes.find(
            (umlClass) => umlClass.name === 'Consumer',
        )!

        expect(consumer.associations.Definitions).toMatchObject({
            referenceType: ReferenceType.Storage,
            targetUmlClassName: 'Definitions',
        })
        expect(consumer.associations.Detail).toMatchObject({
            referenceType: ReferenceType.Storage,
            parentUmlClassName: 'Definitions',
            targetUmlClassName: 'Detail',
        })
        expect(Object.keys(consumer.associations)).not.toContain(
            'Definitions.Detail',
        )
    })

    test('resolves filesystem imports through remappings when package lookup fails', () => {
        const baseDirectory = mkdtempSync(join(tmpdir(), 'sol2uml-ast-'))
        const sourcePath = join(baseDirectory, 'src', 'Consumer.sol')
        const mappedPath = join(baseDirectory, 'lib', 'math', 'Library.sol')
        mkdirSync(dirname(sourcePath), { recursive: true })
        mkdirSync(dirname(mappedPath), { recursive: true })
        writeFileSync(mappedPath, '')

        try {
            const node = parse(
                'import {Library as LocalLibrary} from "@math/Library.sol";',
                {},
            )
            const classes = convertAST2UmlClasses(
                node,
                sourcePath,
                [parseRemapping('@math/=lib/math/')],
                true,
                baseDirectory,
            )

            expect(classes[0].imports).toEqual([
                {
                    absolutePath: mappedPath,
                    classNames: [
                        { className: 'Library', alias: 'LocalLibrary' },
                    ],
                },
            ])
        } finally {
            rmSync(baseDirectory, { recursive: true, force: true })
        }
    })
})
