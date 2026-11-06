import { spawnSync } from 'child_process'

type StorageRow = [string, number, number, number]

type ContractEvidence = {
    toolkitRoot: StorageRow[]
    compilerRoot: StorageRow[]
    resolvedParent?: { name: string; isContract: boolean }
}

type AssociationShadowingEvidence = {
    solcVersion: string
    contracts: Record<string, ContractEvidence>
}

const readAssociationShadowingEvidence = (): AssociationShadowingEvidence => {
    const script = String.raw`
const fs = require('node:fs')
const path = require('node:path')
const solc = require('solc')
const {
  convertClasses2StorageSections,
  getSolidityFilesFromFolderOrFile,
  parseUmlClassesFromFiles,
} = require('./src/ts/index.ts')
const { ClassStereotype } = require('./src/ts/umlClass.ts')
const { findAssociatedClass } = require('./src/ts/associations.ts')

;(async () => {
  const fixtureDirectory = fs.realpathSync('tests/contracts/association-shadowing')
  const files = (await getSolidityFilesFromFolderOrFile(fixtureDirectory)).sort()
  const classes = await parseUmlClassesFromFiles([fixtureDirectory], [])
  const sources = Object.fromEntries(files.map((file) => [
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

  const contracts = Object.fromEntries(['LocalShadow', 'InheritedShadow', 'ImportedShadow'].map((contractName) => {
    const contract = classes.find(({ name, stereotype }) =>
      name === contractName && stereotype === ClassStereotype.Contract)
    if (!contract) throw new Error('Missing parsed contract ' + contractName)
    const root = convertClasses2StorageSections(contractName, classes, 2)
      .find(({ type }) => type === 'Contract')
    if (!root) throw new Error('Missing parsed storage for ' + contractName)
    const sourcePath = files.map((file) => path.relative(process.cwd(), file).split(path.sep).join('/'))
      .find((file) => fs.readFileSync(file, 'utf8').includes('contract ' + contractName + ' '))
    if (!sourcePath) throw new Error('Missing source for ' + contractName)
    const compilerLayout = compilerOutput.contracts[sourcePath][contractName].storageLayout
    const parentAssociation = contract.getParentContracts()[0]
    const resolvedParent = parentAssociation
      ? findAssociatedClass(parentAssociation, contract, classes)
      : undefined
    if (parentAssociation && !resolvedParent) throw new Error('Missing resolved parent for ' + contractName)
    return [contractName, {
      toolkitRoot: root.variables.map(({ name, fromSlot, byteOffset, byteSize }) => [
        name, Number(fromSlot), byteOffset, byteSize,
      ]),
      compilerRoot: compilerLayout.storage.map(({ label, slot, offset, type }) => [
        label, Number(slot), offset, Number(compilerLayout.types[type].numberOfBytes),
      ]),
      resolvedParent: resolvedParent
        ? {
            name: resolvedParent.name,
            isContract: resolvedParent.stereotype === ClassStereotype.Contract,
          }
        : undefined,
    }]
  }))

  process.stdout.write(JSON.stringify({
    solcVersion: solc.version().split('+')[0],
    contracts,
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
            `Association shadowing process failed (${result.status}): ${result.stderr}`,
        )
    }
    return JSON.parse(result.stdout) as AssociationShadowingEvidence
}

describe('association type shadowing', () => {
    let evidence: AssociationShadowingEvidence

    beforeAll(() => {
        evidence = readAssociationShadowingEvidence()
    })

    test('matches native parser storage to solc 0.8.38 for lexical structs', () => {
        expect(evidence.solcVersion).toBe('0.8.38')

        for (const contractName of [
            'LocalShadow',
            'InheritedShadow',
            'ImportedShadow',
        ]) {
            const contract = evidence.contracts[contractName]
            expect(contract.compilerRoot).toEqual([
                ['s', 0, 0, 32],
                ['afterS', 1, 0, 32],
            ])
            expect(contract.toolkitRoot).toEqual(contract.compilerRoot)
            if (contractName === 'LocalShadow') {
                expect(contract.resolvedParent).toBeUndefined()
            } else {
                expect(contract.resolvedParent).toEqual({
                    name: 'Base',
                    isContract: true,
                })
            }
        }
    })
})
