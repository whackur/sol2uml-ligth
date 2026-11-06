import { spawnSync } from 'child_process'
import { readFileSync, realpathSync } from 'fs'
import { join } from 'path'

jest.setTimeout(120_000)

const solc = require('solc') as {
    version: () => string
    compile: (
        input: string,
        callbacks?: {
            import: (path: string) => { contents?: string; error?: string }
        },
    ) => string
}

const fixtureDirectory = realpathSync(
    join(process.cwd(), 'tests/contracts/current'),
)
const openZeppelinDirectory = realpathSync(
    join(process.cwd(), 'node_modules/@openzeppelin/contracts'),
)
const accountAbstractionDirectory = realpathSync(
    join(process.cwd(), 'node_modules/@account-abstraction/contracts'),
)
const exampleFiles = [
    'ExampleToken.sol',
    'ExampleNft.sol',
    'ExampleVault.sol',
] as const
const expectedDiagramClasses: Record<string, string[]> = {
    EntryPoint: ['StakeManager', 'ReentrancyGuardTransient'],
    SimpleAccount: ['BaseAccount', 'UUPSUpgradeable'],
    IAccount: ['PackedUserOperation'],
}

type CompilerOutput = {
    errors?: { severity: string; formattedMessage: string }[]
    contracts?: Record<
        string,
        Record<
            string,
            {
                evm?: { bytecode?: { object?: string } }
                storageLayout?: {
                    storage: { label: string; slot: string; offset: number }[]
                }
            }
        >
    >
}

const resolveImport = (importPath: string) => {
    try {
        return {
            contents: readFileSync(
                require.resolve(importPath, { paths: [process.cwd()] }),
                'utf8',
            ),
        }
    } catch (error) {
        return {
            error: `Unable to resolve Solidity import ${importPath}: ${String(error)}`,
        }
    }
}

const compileExamples = (): CompilerOutput => {
    const sources = Object.fromEntries(
        exampleFiles.map((file) => [
            `tests/contracts/current/${file}`,
            {
                content: readFileSync(join(fixtureDirectory, file), 'utf8'),
            },
        ]),
    )
    const input = {
        language: 'Solidity',
        sources,
        settings: {
            evmVersion: 'osaka',
            optimizer: { enabled: true, runs: 200 },
            outputSelection: {
                '*': {
                    '*': ['evm.bytecode.object', 'storageLayout'],
                },
            },
        },
    }

    return JSON.parse(
        solc.compile(JSON.stringify(input), { import: resolveImport }),
    ) as CompilerOutput
}

type NativeParserEvidence = {
    openZeppelinFiles: number
    missingOpenZeppelinFiles: string[]
    accountAbstractionFiles: number
    missingAccountAbstractionFiles: string[]
    erc20Update: boolean
    erc20ConstructorParameters: string[]
    ownableConstructorParameters: string[]
    exampleTokenParents: string[]
    storageConformance: {
        contractName: string
        toolkit: [string, number | undefined, number][]
        compiler: [string, number, number][]
    }[]
    diagrams: {
        contractName: string
        hasAccountAbstractionImport: boolean
        hasOpenZeppelinImport: boolean
        parentNames: string[]
        dotIncludesContract: boolean
        dotIncludesParents: string[]
        classNames: string[]
        hasSvgMarkup: boolean
        svgIncludesContract: boolean
    }[]
}

const readNativeParserEvidence = (): NativeParserEvidence => {
    const script = String.raw`
const fs = require('node:fs')
const {
  convertClasses2StorageSections,
  convertDot2Svg,
  convertUmlClasses2Dot,
  getSolidityFilesFromFolderOrFile,
  parseUmlClassesFromFiles,
} = require('./src/ts/index.ts')
const { findAssociatedClass } = require('./src/ts/associations.ts')
const solc = require('solc')

const findClass = (classes, name) => {
  const result = classes.find((candidate) => candidate.name === name)
  if (!result) throw new Error('Missing parsed class ' + name)
  return result
}
const diagramClasses = (classes, name) => {
  const root = findClass(classes, name)
  const selected = new Map()
  const pending = [root]
  while (pending.length > 0) {
    const current = pending.pop()
    if (selected.has(current.id)) continue
    selected.set(current.id, current)
    if (current === root) {
      for (const link of current.imports) {
        for (const candidate of classes.filter((item) =>
          item.absolutePath === link.absolutePath &&
          (link.classNames.length === 0 || link.classNames.some(({ className, alias }) =>
            item.name === className || item.name === alias)))) {
          pending.push(candidate)
        }
      }
    }
    for (const parent of current.getParentContracts()) {
      const parentClass = findAssociatedClass(parent, current, classes)
      if (parentClass) pending.push(parentClass)
    }
  }
  return [...selected.values()]
}
const compileExampleStorage = () => {
  const examples = [
    ['ExampleToken.sol', 'ExampleToken'],
    ['ExampleNft.sol', 'ExampleNft'],
    ['ExampleVault.sol', 'ExampleVault'],
  ]
  const sources = Object.fromEntries(examples.map(([file]) => {
    const sourcePath = 'tests/contracts/current/' + file
    return [sourcePath, { content: fs.readFileSync(sourcePath, 'utf8') }]
  }))
  const input = {
    language: 'Solidity',
    sources,
    settings: {
      evmVersion: 'osaka',
      outputSelection: { '*': { '*': ['storageLayout'] } },
    },
  }
  const output = JSON.parse(solc.compile(JSON.stringify(input), {
    import(importPath) {
      try {
        return { contents: fs.readFileSync(require.resolve(importPath, { paths: [process.cwd()] }), 'utf8') }
      } catch (error) {
        return { error: 'Unable to resolve Solidity import ' + importPath + ': ' + String(error) }
      }
    },
  }))
  const errors = (output.errors || []).filter(({ severity }) => severity === 'error')
  if (errors.length) throw new Error(errors.map(({ formattedMessage }) => formattedMessage).join('\n'))
  return Object.fromEntries(examples.map(([file, contractName]) => {
    const sourcePath = 'tests/contracts/current/' + file
    return [contractName, output.contracts[sourcePath][contractName].storageLayout.storage]
  }))
}

;(async () => {
  const fixtureDirectory = fs.realpathSync('tests/contracts/current')
  const openZeppelinDirectory = fs.realpathSync('node_modules/@openzeppelin/contracts')
  const accountAbstractionDirectory = fs.realpathSync('node_modules/@account-abstraction/contracts')
  const openZeppelinFiles = await getSolidityFilesFromFolderOrFile(openZeppelinDirectory)
  const accountAbstractionFiles = await getSolidityFilesFromFolderOrFile(accountAbstractionDirectory)
  const classes = await parseUmlClassesFromFiles(
    [fixtureDirectory, accountAbstractionDirectory, openZeppelinDirectory],
    [],
  )
  const parsedPaths = new Set(classes.map(({ absolutePath }) => absolutePath))
  const missingOpenZeppelinFiles = openZeppelinFiles.filter((file) => !parsedPaths.has(fs.realpathSync(file)))
  const missingAccountAbstractionFiles = accountAbstractionFiles.filter((file) => !parsedPaths.has(fs.realpathSync(file)))
  const erc20 = findClass(classes, 'ERC20')
  const ownable = findClass(classes, 'Ownable')
  const exampleToken = findClass(classes, 'ExampleToken')
  const compilerStorage = compileExampleStorage()
  const storageConformance = ['ExampleToken', 'ExampleNft', 'ExampleVault'].map((contractName) => ({
    contractName,
    toolkit: convertClasses2StorageSections(contractName, classes, 1)[0].variables
      .map(({ name, fromSlot, byteOffset }) => [name, fromSlot, byteOffset]),
    compiler: compilerStorage[contractName]
      .map(({ label, slot, offset }) => [label, Number(slot), offset]),
  }))
  const diagrams = ['EntryPoint', 'SimpleAccount', 'IAccount'].map((contractName) => {
    const target = findClass(classes, contractName)
    const imports = target.imports.map(({ absolutePath }) => absolutePath)
    const diagram = diagramClasses(classes, contractName)
    const dot = convertUmlClasses2Dot(diagram)
    const svg = convertDot2Svg(dot)
    const parentNames = target.getParentContracts().map(({ targetUmlClassName }) => targetUmlClassName)
    return {
      contractName,
      hasAccountAbstractionImport: imports.some((file) => file.startsWith(accountAbstractionDirectory)),
      hasOpenZeppelinImport: imports.some((file) => file.startsWith(openZeppelinDirectory)),
      parentNames,
      dotIncludesContract: dot.includes(contractName),
      dotIncludesParents: parentNames.filter((name) => dot.includes(name)),
      classNames: diagram.map(({ name }) => name),
      hasSvgMarkup: /<svg[^>]+/.test(svg),
      svgIncludesContract: svg.includes(contractName),
    }
  })
  process.stdout.write(JSON.stringify({
    openZeppelinFiles: openZeppelinFiles.length,
    missingOpenZeppelinFiles,
    accountAbstractionFiles: accountAbstractionFiles.length,
    missingAccountAbstractionFiles,
    erc20Update: erc20.operators.some(({ name }) => name === '_update'),
    erc20ConstructorParameters: erc20.operators.find(({ name }) => name === 'constructor').parameters.map(({ name }) => name),
    ownableConstructorParameters: ownable.operators.find(({ name }) => name === 'constructor').parameters.map(({ name }) => name),
    exampleTokenParents: exampleToken.getParentContracts().map(({ targetUmlClassName }) => targetUmlClassName),
    storageConformance,
    diagrams,
  }))
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error)
  process.exit(1)
})
`
    const result = spawnSync(
        process.execPath,
        ['-r', 'ts-node/register', '-e', script],
        { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
    )

    if (result.error) throw result.error
    if (result.status !== 0) {
        throw new Error(
            `Native parser process failed (${result.status}): ${result.stderr}`,
        )
    }
    return JSON.parse(result.stdout) as NativeParserEvidence
}

describe('current library fixtures', () => {
    let evidence: NativeParserEvidence

    beforeAll(() => {
        evidence = readNativeParserEvidence()
    })

    test('compiles all current examples with the pinned compiler', () => {
        expect(solc.version().split('+')[0]).toBe('0.8.38')

        const output = compileExamples()
        expect(
            (output.errors ?? [])
                .filter(({ severity }) => severity === 'error')
                .map(({ formattedMessage }) => formattedMessage),
        ).toEqual([])

        for (const [file, contract] of [
            ['ExampleToken.sol', 'ExampleToken'],
            ['ExampleNft.sol', 'ExampleNft'],
            ['ExampleVault.sol', 'ExampleVault'],
        ]) {
            expect(
                output.contracts?.[`tests/contracts/current/${file}`]?.[
                    contract
                ]?.evm?.bytecode?.object,
            ).toMatch(/^[0-9a-f]+$/)
        }
    })

    test('parses every Solidity file in the installed OpenZeppelin package', () => {
        expect(evidence.openZeppelinFiles).toBeGreaterThan(0)
        expect(evidence.missingOpenZeppelinFiles).toEqual([])
        expect(evidence.accountAbstractionFiles).toBeGreaterThan(0)
        expect(evidence.missingAccountAbstractionFiles).toEqual([])
        expect(evidence.erc20Update).toBe(true)
        expect(evidence.erc20ConstructorParameters).toEqual([
            'name_',
            'symbol_',
        ])
        expect(evidence.ownableConstructorParameters).toEqual(['initialOwner'])
        expect(evidence.exampleTokenParents).toEqual(
            expect.arrayContaining(['ERC20', 'Ownable']),
        )
    })

    test.each(['ExampleToken', 'ExampleNft', 'ExampleVault'])(
        'matches %s storage positions to solc storage layout',
        (contractName) => {
            const storage = evidence.storageConformance.find(
                ({ contractName: name }) => name === contractName,
            )!
            expect(storage.toolkit).toEqual(storage.compiler)
        },
    )

    test.each(['EntryPoint', 'SimpleAccount', 'IAccount'])(
        'renders the %s account-abstraction package diagram',
        (contractName) => {
            const diagram = evidence.diagrams.find(
                ({ contractName: name }) => name === contractName,
            )!
            expect(diagram.hasAccountAbstractionImport).toBe(true)
            expect(diagram.hasOpenZeppelinImport).toBe(
                contractName !== 'IAccount',
            )
            expect(diagram.dotIncludesContract).toBe(true)
            expect(diagram.dotIncludesParents).toEqual(diagram.parentNames)
            expect(diagram.classNames).toEqual(
                expect.arrayContaining(expectedDiagramClasses[contractName]),
            )
            expect(diagram.hasSvgMarkup).toBe(true)
            expect(diagram.svgIncludesContract).toBe(true)
        },
    )
})
