import { spawnSync } from 'child_process'

type StorageRow = [string, number, number, number]

type StructEvidence = {
    name: string
    byteSize: number
    variables: StorageRow[]
}

type StorageVariableEvidence = {
    name?: string
    slot: number
    offset: number
    byteSize: number
    type: string
    referenceSectionId?: number
    enumValues?: string[]
}

type StorageSectionEvidence = {
    id: number
    name: string
    type: string
    mapping: boolean
    arrayLength?: number
    arrayDynamic?: boolean
    variables: StorageVariableEvidence[]
}

type ContractEvidence = {
    toolkitRoot: StorageRow[]
    compilerRoot: StorageRow[]
    toolkitSections: StorageSectionEvidence[]
    compilerStructs: StructEvidence[]
}

type StorageContextEvidence = {
    solcVersion: string
    use: ContractEvidence
    localConstantUse: ContractEvidence
    fileLevel: ContractEvidence
}

const readStorageContextEvidence = (): StorageContextEvidence => {
    const script = String.raw`
const fs = require('node:fs')
const path = require('node:path')
const solc = require('solc')
const {
  convertClasses2StorageSections,
  getSolidityFilesFromFolderOrFile,
  parseUmlClassesFromFiles,
} = require('./src/ts/index.ts')

;(async () => {
  const fixtureDirectory = fs.realpathSync('tests/contracts/storage-context')
  const fileLevelDirectory = fs.realpathSync('src/contracts/fileLevel')
  const fixtureFiles = (await getSolidityFilesFromFolderOrFile(fixtureDirectory)).sort()
  const fileLevelFiles = (await getSolidityFilesFromFolderOrFile(fileLevelDirectory)).sort()
  const classes = await parseUmlClassesFromFiles(
    [fixtureDirectory, fileLevelDirectory],
    [],
  )
  const sourceFiles = [...fixtureFiles, ...fileLevelFiles]
  const sources = Object.fromEntries(sourceFiles.map((file) => [
    path.relative(process.cwd(), file).split(path.sep).join('/'),
    { content: fs.readFileSync(file, 'utf8') },
  ]))
  const compilerOutput = JSON.parse(solc.compile(JSON.stringify({
    language: 'Solidity',
    sources,
    settings: { outputSelection: { '*': { '*': ['storageLayout'] } } },
  })))
  const errors = (compilerOutput.errors || []).filter(({ severity }) => severity === 'error')
  if (errors.length) throw new Error(errors.map(({ formattedMessage }) => formattedMessage).join('\n'))

  const toContractEvidence = (contractName, sourcePath) => {
    const sections = convertClasses2StorageSections(contractName, classes, 2)
    const root = sections.find(({ type }) => type === 'Contract')
    if (!root) throw new Error('Missing parsed ' + contractName + ' contract storage section')
    const compilerLayout = compilerOutput.contracts[sourcePath][contractName].storageLayout
    const rows = (variables, relativeToSection = false) => {
      const origin = relativeToSection
        ? Math.min(...variables.map(({ fromSlot }) => Number(fromSlot)))
        : 0
      return variables.map(({ name, fromSlot, byteOffset, byteSize }) => [
        name,
        Number(fromSlot) - origin,
        byteOffset,
        byteSize,
      ])
    }
    return {
      toolkitRoot: rows(root.variables),
      compilerRoot: compilerLayout.storage.map(({ label, slot, offset, type }) => [
        label,
        Number(slot),
        offset,
        Number(compilerLayout.types[type].numberOfBytes),
      ]),
      toolkitSections: sections.map(({ id, name, type, mapping, arrayLength, arrayDynamic, variables }) => ({
        id,
        name,
        type,
        mapping,
        arrayLength,
        arrayDynamic,
        variables: variables.map((variable) => ({
          name: variable.name,
          slot: Number(variable.fromSlot) - (type === 'Contract' ? 0 : Math.min(...variables.map(({ fromSlot }) => Number(fromSlot)))),
          offset: variable.byteOffset,
          byteSize: variable.byteSize,
          type: variable.type,
          referenceSectionId: variable.referenceSectionId,
          enumValues: variable.enumValues,
        })),
      })),
      compilerStructs: Object.values(compilerLayout.types)
        .filter(({ members }) => Array.isArray(members))
        .map(({ label, numberOfBytes, members }) => ({
          name: label.replace(/^struct /, ''),
          byteSize: Number(numberOfBytes),
          variables: members.map(({ label: memberLabel, slot, offset, type }) => [
            memberLabel,
            Number(slot),
            offset,
            Number(compilerLayout.types[type].numberOfBytes),
          ]),
        })),
    }
  }

  process.stdout.write(JSON.stringify({
    solcVersion: solc.version().split('+')[0],
    use: toContractEvidence('Use', 'tests/contracts/storage-context/Use.sol'),
    localConstantUse: toContractEvidence('LocalConstantUse', 'tests/contracts/storage-context/Use.sol'),
    fileLevel: toContractEvidence('TestContract', 'src/contracts/fileLevel/FileLevel.sol'),
  }))
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error)
  process.exit(1)
})
`
    const result = spawnSync(
        process.execPath,
        ['-r', 'ts-node/register/transpile-only', '-e', script],
        { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 },
    )

    if (result.error) throw result.error
    if (result.status !== 0) {
        throw new Error(
            `Storage context process failed (${result.status}): ${result.stderr}`,
        )
    }
    return JSON.parse(result.stdout) as StorageContextEvidence
}

describe('storage type context', () => {
    let evidence: StorageContextEvidence

    const compilerStruct = (contract: ContractEvidence, name: string) => {
        const struct = contract.compilerStructs.find(
            (candidate) => candidate.name === name,
        )
        expect(struct).toBeDefined()
        return struct!
    }

    const toolkitStructs = (contract: ContractEvidence, name: string) =>
        contract.toolkitSections.filter(
            (candidate) =>
                candidate.type === 'Struct' &&
                candidate.name.split('.').at(-1) === name,
        )

    beforeAll(() => {
        evidence = readStorageContextEvidence()
    })

    test('matches compiler root positions and nested struct field layouts', () => {
        expect(evidence.solcVersion).toBe('0.8.38')

        const expectedUseRoot = [
            ['head', 0, 0, 1],
            ['outer', 1, 0, 224],
            ['leaves', 8, 0, 64],
            ['records', 10, 0, 32],
            ['tail', 11, 0, 1],
            ['dimensioned', 12, 0, 64],
            ['dimensionTail', 14, 0, 32],
        ]
        expect(evidence.use.compilerRoot).toEqual(expectedUseRoot)
        expect(evidence.use.toolkitRoot).toEqual(evidence.use.compilerRoot)

        for (const name of ['FileData', 'L.Leaf', 'L.Inner', 'L.Outer']) {
            const compiler = compilerStruct(evidence.use, name)
            const toolkit = toolkitStructs(
                evidence.use,
                name.split('.').at(-1)!,
            )
            expect(toolkit.length).toBeGreaterThan(0)
            for (const parsed of toolkit) {
                expect(
                    parsed.variables.map(({ name, slot, offset, byteSize }) => [
                        name,
                        slot,
                        offset,
                        byteSize,
                    ]),
                ).toEqual(compiler.variables)
            }
        }

        expect(compilerStruct(evidence.use, 'L.Leaf')).toMatchObject({
            byteSize: 32,
            variables: [
                ['a', 0, 0, 16],
                ['b', 0, 16, 16],
            ],
        })
        expect(compilerStruct(evidence.use, 'L.Inner')).toMatchObject({
            byteSize: 64,
            variables: [
                ['leaf', 0, 0, 32],
                ['kind', 1, 0, 1],
                ['n', 1, 1, 1],
            ],
        })
        expect(compilerStruct(evidence.use, 'L.Outer')).toMatchObject({
            byteSize: 224,
            variables: [
                ['inner', 0, 0, 64],
                ['data', 2, 0, 32],
                ['fixedLeaves', 3, 0, 64],
                ['records', 5, 0, 32],
                ['dynamicLeaves', 6, 0, 32],
            ],
        })
    })

    test('resolves expanded references through aliases, enums, mappings, and arrays', () => {
        const sections = evidence.use.toolkitSections
        const sectionFor = (id: number | undefined) => {
            expect(id).toBeDefined()
            const section = sections.find(
                ({ id: sectionId }) => sectionId === id,
            )
            expect(section).toBeDefined()
            return section!
        }
        const variable = (
            section: StorageSectionEvidence,
            name: string,
        ): StorageVariableEvidence => {
            const result = section.variables.find(
                (candidate) => candidate.name === name,
            )
            expect(result).toBeDefined()
            return result!
        }
        const root = sections.find(({ type }) => type === 'Contract')!
        const outer = sectionFor(variable(root, 'outer').referenceSectionId)
        expect(outer.name).toBe('Alias.Outer')
        const inner = sectionFor(variable(outer, 'inner').referenceSectionId)
        expect(inner.name).toBe('Inner')
        expect(variable(inner, 'kind').enumValues).toEqual(['A', 'B'])
        expect(
            sectionFor(variable(outer, 'data').referenceSectionId).name,
        ).toBe('FileData')

        const fixedLeaves = sectionFor(
            variable(outer, 'fixedLeaves').referenceSectionId,
        )
        expect(fixedLeaves).toMatchObject({
            type: 'Array',
            arrayLength: 2,
            arrayDynamic: false,
        })
        expect(fixedLeaves.variables).toHaveLength(2)
        expect(
            fixedLeaves.variables.map(
                ({ referenceSectionId }) => sectionFor(referenceSectionId).type,
            ),
        ).toEqual(['Struct', 'Struct'])

        const records = sectionFor(
            variable(outer, 'records').referenceSectionId,
        )
        expect(records).toMatchObject({ type: 'Struct', mapping: true })
        const dynamicLeaves = sectionFor(
            variable(outer, 'dynamicLeaves').referenceSectionId,
        )
        expect(dynamicLeaves).toMatchObject({
            type: 'Array',
            arrayDynamic: true,
        })
        expect(dynamicLeaves.arrayLength).toBeUndefined()
        expect(
            sectionFor(dynamicLeaves.variables[0].referenceSectionId).type,
        ).toBe('Struct')
    })

    test('uses each struct declaration owner for fixed array constants', () => {
        const local = evidence.localConstantUse
        const localRoot = [
            ['value', 0, 0, 64],
            ['tail', 2, 0, 32],
        ]
        expect(local.compilerRoot).toEqual(localRoot)
        expect(local.toolkitRoot).toEqual(local.compilerRoot)
        expect(compilerStruct(local, 'LocalConstantUse.S')).toMatchObject({
            byteSize: 64,
            variables: [['items', 0, 0, 64]],
        })
        const localArray = local.toolkitSections.find(
            ({ type, name }) =>
                type === 'Array' && name === 'uint256[N]: items',
        )
        expect(localArray).toMatchObject({
            arrayLength: 2,
            arrayDynamic: false,
        })

        const use = evidence.use
        expect(compilerStruct(use, 'L.Dimensioned')).toMatchObject({
            byteSize: 64,
            variables: [['items', 0, 0, 64]],
        })
        const dimensionedArray = use.toolkitSections.find(
            ({ type, name }) =>
                type === 'Array' && name === 'uint256[N]: items',
        )
        expect(dimensionedArray).toMatchObject({
            arrayLength: 2,
            arrayDynamic: false,
        })
    })

    test('compiles the full file-level fixture and matches TestContract storage', () => {
        expect(evidence.fileLevel.compilerRoot).toEqual([
            ['status', 0, 0, 1],
            ['fls', 1, 0, 128],
            ['fls2', 5, 0, 128],
            ['clus', 9, 0, 64],
            ['plus', 11, 0, 64],
            ['clue', 13, 0, 1],
            ['plue', 13, 1, 1],
            ['ll', 14, 0, 32],
            ['ll2', 15, 0, 160],
            ['ll3', 20, 0, 64],
            ['lle', 22, 0, 1],
        ])
        expect(evidence.fileLevel.toolkitRoot).toEqual(
            evidence.fileLevel.compilerRoot,
        )
    })
})
