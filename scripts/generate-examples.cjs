#!/usr/bin/env node

const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const projectRoot = path.resolve(__dirname, '..')
const cliPath = path.join(projectRoot, 'lib', 'sol2uml.js')
const expectedVersions = {
    '@openzeppelin/contracts': '5.6.1',
    '@account-abstraction/contracts': '0.8.0',
}

function packageVersion(packageName) {
    const manifestPath = path.join(
        projectRoot,
        'node_modules',
        ...packageName.split('/'),
        'package.json',
    )
    if (!fs.existsSync(manifestPath)) {
        throw new Error(`Missing installed package metadata: ${manifestPath}`)
    }
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8')).version
}

function verifyPackageVersions() {
    for (const [packageName, expectedVersion] of Object.entries(
        expectedVersions,
    )) {
        const installedVersion = packageVersion(packageName)
        if (installedVersion !== expectedVersion) {
            throw new Error(
                `${packageName} must be ${expectedVersion} for the checked-in examples; found ${installedVersion}`,
            )
        }
    }
    process.stdout.write(
        `Generating current examples with @openzeppelin/contracts ${expectedVersions['@openzeppelin/contracts']} and @account-abstraction/contracts ${expectedVersions['@account-abstraction/contracts']}\n`,
    )
}

function requirePath(relativePath) {
    const absolutePath = path.join(projectRoot, relativePath)
    if (!fs.existsSync(absolutePath)) {
        throw new Error(`Missing example input: ${relativePath}`)
    }
    return absolutePath
}

function packageSourceRoot(packageName) {
    return fs.realpathSync(requirePath(path.join('node_modules', packageName)))
}

function runDiagram(kind, sourceRoots, args, outputPath, expectedText) {
    const absoluteOutputPath = path.join(projectRoot, outputPath)
    const isPng = path.extname(outputPath).toLowerCase() === '.png'
    fs.mkdirSync(path.dirname(absoluteOutputPath), { recursive: true })
    execFileSync(
        process.execPath,
        [cliPath, kind, sourceRoots, ...args, '--outputFileName', outputPath],
        { cwd: projectRoot, stdio: 'inherit' },
    )

    if (isPng) {
        const png = fs.readFileSync(absoluteOutputPath)
        if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
            throw new Error(`Expected a PNG image in ${outputPath}`)
        }
    } else {
        const svg = fs.readFileSync(absoluteOutputPath, 'utf8')
        if (!svg.includes('<svg')) {
            throw new Error(`Expected an SVG document in ${outputPath}`)
        }
        for (const expected of expectedText) {
            if (!svg.includes(expected)) {
                throw new Error(
                    `Expected ${JSON.stringify(expected)} in ${outputPath}`,
                )
            }
        }
    }
    return outputPath
}

function classDiagram(sourceRoots, args, outputPath, expectedText) {
    return runDiagram(
        'class',
        sourceRoots,
        [...args, '--hideFilename'],
        outputPath,
        expectedText,
    )
}

function storageDiagram(
    sourceRoots,
    contractName,
    outputPath,
    expectedText = [contractName],
    args = [],
) {
    return runDiagram(
        'storage',
        sourceRoots,
        ['--contract', contractName, ...args],
        outputPath,
        expectedText,
    )
}

function main() {
    if (!fs.existsSync(cliPath)) {
        throw new Error('Missing built CLI; run `pnpm run build` first')
    }

    verifyPackageVersions()

    const openZeppelinRoot = packageSourceRoot('@openzeppelin/contracts')
    const accountAbstractionRoot = packageSourceRoot(
        '@account-abstraction/contracts',
    )
    const currentFixturesRoot = requirePath('tests/contracts/current')
    const modernFixturesRoot = requirePath('tests/contracts/modern')
    const currentContracts = [
        'ExampleToken.sol',
        'ExampleNft.sol',
        'ExampleVault.sol',
    ].map((name) => requirePath(path.join('tests/contracts/current', name)))
    const modernContracts = ['OsakaFeatures.sol', 'AmsterdamFeatures.sol'].map(
        (name) => requirePath(path.join('tests/contracts/modern', name)),
    )

    const openZeppelinSources = openZeppelinRoot
    const fixtureSources = [currentFixturesRoot, openZeppelinRoot].join(',')
    const accountAbstractionSources = [
        accountAbstractionRoot,
        openZeppelinRoot,
    ].join(',')

    const generated = []
    generated.push(
        classDiagram(
            openZeppelinSources,
            ['--baseContractNames', 'ERC20'],
            'examples/OpenZeppelinERC20.svg',
            ['ERC20', 'IERC20'],
        ),
    )
    generated.push(
        classDiagram(openZeppelinSources, [], 'examples/OpenZeppelinAll.svg', [
            'ERC20',
            'ERC721',
            'AccessControl',
        ]),
    )
    generated.push(
        classDiagram(
            openZeppelinSources,
            ['--baseContractNames', 'ERC721'],
            'examples/current/OpenZeppelinERC721.svg',
            ['ERC721', 'IERC721'],
        ),
    )
    generated.push(
        classDiagram(
            openZeppelinSources,
            ['--baseContractNames', 'AccessControl'],
            'examples/current/OpenZeppelinAccessControl.svg',
            ['AccessControl', 'IAccessControl'],
        ),
    )

    for (const [contractName, fileName, classIncludes, storageIncludes] of [
        [
            'ExampleToken',
            'ExampleToken',
            ['ExampleToken', 'ERC20', 'Ownable'],
            ['ExampleToken', 'ERC20._balances', 'Ownable._owner'],
        ],
        [
            'ExampleNft',
            'ExampleNft',
            ['ExampleNft', 'ERC721', 'Ownable'],
            ['ExampleNft', 'ERC721._owners', 'Ownable._owner'],
        ],
        [
            'ExampleVault',
            'ExampleVault',
            ['ExampleVault', 'ERC4626'],
            ['ExampleVault', 'ERC20._totalSupply'],
        ],
    ]) {
        const sourceFile = currentContracts.find(
            (filePath) => path.basename(filePath) === `${fileName}.sol`,
        )
        if (!sourceFile) {
            throw new Error(
                `Missing current fixture source for ${contractName}`,
            )
        }
        generated.push(
            classDiagram(
                fixtureSources,
                ['--baseContractNames', contractName],
                `examples/current/${fileName}.svg`,
                classIncludes,
            ),
        )
        generated.push(
            storageDiagram(
                fixtureSources,
                contractName,
                `examples/current/${fileName}Storage.svg`,
                storageIncludes,
            ),
        )
    }

    for (const [contractName, fileName] of [
        ['OsakaFeatures', 'OsakaFeatures'],
        ['AmsterdamFeatures', 'AmsterdamFeatures'],
    ]) {
        const sourceFile = modernContracts.find(
            (filePath) => path.basename(filePath) === `${fileName}.sol`,
        )
        if (!sourceFile) {
            throw new Error(`Missing modern fixture source for ${contractName}`)
        }
        generated.push(
            classDiagram(
                modernFixturesRoot,
                ['--baseContractNames', contractName],
                `examples/current/${fileName}.svg`,
                [contractName],
            ),
        )
    }

    for (const contractName of [
        'BasicStorage',
        'DynamicArrayStorage',
        'FixedArrayStorage',
        'MappingStorage',
        'MultiDynamicArrayStorage',
        'MultiFixedArrayStorage',
        'StringStorage',
        'StructStorage',
        'TestStorage',
    ]) {
        generated.push(
            storageDiagram(
                'src/contracts/storage',
                contractName,
                `examples/storage/${contractName}.svg`,
            ),
        )
    }
    generated.push(
        storageDiagram(
            'src/contracts/fileLevel',
            'TestContract',
            'examples/storage/FileLevel-storage.svg',
            [
                'TestContract',
                'LibraryStructs.LibraryLevel',
                'LibraryStructs.LibraryLevelEnum',
            ],
        ),
    )
    generated.push(
        storageDiagram(
            'src/contracts/fileLevel',
            'TestContract',
            'examples/storage/FileLevel-storage.png',
            [],
            ['--outputFormat', 'png'],
        ),
    )
    generated.push(
        storageDiagram(
            'src/contracts/storage',
            'BasicStorage',
            'examples/storage/BasicStorageColor.svg',
            ['BasicStorage'],
            [
                '--shapeColor',
                'deeppink',
                '--textColor',
                '#ffffff',
                '--fillColor',
                'dimgrey',
                '--backColor',
                'black',
            ],
        ),
    )
    generated.push(
        classDiagram(
            'src/contracts/inheritance',
            ['--clusterFolders'],
            'examples/inheritanceDiamond.svg',
            ['D'],
        ),
    )
    generated.push(
        classDiagram(
            'src/contracts/inheritance',
            ['--clusterFolders', '--outputFormat', 'png'],
            'examples/inheritanceDiamond.png',
            [],
        ),
    )
    generated.push(
        storageDiagram(
            'src/contracts/inheritance',
            'D',
            'examples/storage/inheritanceStorage.svg',
        ),
    )

    const accountAbstractionDiagrams = [
        ['IAccount', ['--baseContractNames', 'IAccount'], ['IAccount']],
        [
            'SimpleAccountHierarchy',
            [
                '--baseContractNames',
                'SimpleAccount',
                '--hideFunctions',
                '--hideVariables',
                '--hideEnums',
                '--hideStructs',
            ],
            ['SimpleAccount'],
        ],
        [
            'SimpleAccountSquashedPub',
            [
                '--baseContractNames',
                'SimpleAccount',
                '--squash',
                '--depth',
                '0',
                '--hidePrivates',
            ],
            ['SimpleAccount'],
        ],
        [
            'SimpleAccountSquashed',
            [
                '--baseContractNames',
                'SimpleAccount',
                '--squash',
                '--depth',
                '0',
            ],
            ['SimpleAccount'],
        ],
        [
            'SimpleAccountDepth0',
            ['--baseContractNames', 'SimpleAccount', '--depth', '0'],
            ['SimpleAccount'],
        ],
        [
            'SimpleAccountDepth1',
            ['--baseContractNames', 'SimpleAccount', '--depth', '1'],
            ['SimpleAccount'],
        ],
        [
            'SimpleAccountLinked',
            ['--baseContractNames', 'SimpleAccount'],
            ['SimpleAccount'],
        ],
        [
            'EntryPointHierarchy',
            [
                '--baseContractNames',
                'EntryPoint',
                '--hideFunctions',
                '--hideVariables',
                '--hideEnums',
                '--hideStructs',
            ],
            ['EntryPoint'],
        ],
        [
            'EntryPointSquashedPub',
            [
                '--baseContractNames',
                'EntryPoint',
                '--squash',
                '--hideSourceContract',
                '--hidePrivates',
                '--depth',
                '0',
            ],
            ['EntryPoint'],
        ],
        [
            'EntryPointSquashedAll',
            [
                '--baseContractNames',
                'EntryPoint',
                '--squash',
                '--hideSourceContract',
                '--depth',
                '0',
            ],
            ['EntryPoint'],
        ],
        [
            'EntryPointSquashedInherit',
            ['--baseContractNames', 'EntryPoint', '--squash', '--depth', '0'],
            ['EntryPoint'],
        ],
        [
            'EntryPointSquashedDepth1',
            ['--baseContractNames', 'EntryPoint', '--squash', '--depth', '1'],
            ['EntryPoint'],
        ],
        [
            'EntryPointLinked',
            ['--baseContractNames', 'EntryPoint', '--depth', '1'],
            ['EntryPoint'],
        ],
        [
            'EntryPointLinkedAll',
            ['--baseContractNames', 'EntryPoint'],
            ['EntryPoint'],
        ],
        [
            'AAStructs',
            [
                '--hideLibraries',
                '--hideInterfaces',
                '--hideEnums',
                '--hideContracts',
            ],
            ['PackedUserOperation'],
        ],
        ['all', ['--ignoreFilesOrFolders', 'samples,test'], ['EntryPoint']],
    ]
    for (const [fileName, args, expectedText] of accountAbstractionDiagrams) {
        generated.push(
            classDiagram(
                accountAbstractionSources,
                args,
                `examples/accountAbstraction/${fileName}.svg`,
                expectedText,
            ),
        )
    }

    process.stdout.write(
        `Generated and checked ${generated.length} current SVG/PNG diagrams.\n`,
    )
}

try {
    main()
} catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`)
    process.exitCode = 1
}
