#!/usr/bin/env node
// Renders the CI smoke diagrams with a given CLI entry file and checks every output exists.
// Usage: node scripts/ci-render-diagrams.cjs <cli-js-path> <output-dir>
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const [cliArg, outArg] = process.argv.slice(2)
if (!cliArg || !outArg) {
    console.error('Usage: ci-render-diagrams.cjs <cli-js-path> <output-dir>')
    process.exit(2)
}
const cliPath = path.resolve(cliArg)
const outDir = path.resolve(outArg)
const projectRoot = path.resolve(__dirname, '..')
// Relative inputs keep the CLI's relative-path handling covered, as the original workflow steps did.
const sources = [
    path.join(projectRoot, 'tests/contracts/current'),
    path.join(projectRoot, 'node_modules/@openzeppelin/contracts'),
]
    .map((source) => path.relative(process.cwd(), source) || '.')
    .join(',')

const cases = [
    ['class', '-b', 'ExampleToken', 'svg', 'ExampleToken-class'],
    ['storage', '-c', 'ExampleToken', 'png', 'ExampleToken-storage'],
    ['class', '-b', 'ExampleNft', 'png', 'ExampleNft-class'],
    ['storage', '-c', 'ExampleNft', 'svg', 'ExampleNft-storage'],
    ['class', '-b', 'ExampleVault', 'all', 'ExampleVault-class'],
    ['storage', '-c', 'ExampleVault', 'all', 'ExampleVault-storage'],
]

fs.mkdirSync(outDir, { recursive: true })
const expected = []
for (const [command, contractFlag, contract, format, name] of cases) {
    const extension = format === 'all' ? 'svg' : format
    const output = path.join(outDir, `${name}.${extension}`)
    const result = spawnSync(
        process.execPath,
        [
            cliPath,
            command,
            sources,
            contractFlag,
            contract,
            '-f',
            format,
            '-o',
            output,
        ],
        { stdio: 'inherit' },
    )
    if (result.status !== 0) {
        throw new Error(
            `${command} ${contract} -f ${format} exited with ${result.status}`,
        )
    }
    const extensions = format === 'all' ? ['dot', 'svg', 'png'] : [extension]
    for (const ext of extensions)
        expected.push(path.join(outDir, `${name}.${ext}`))
}

for (const file of expected) {
    if (!fs.existsSync(file) || fs.statSync(file).size === 0) {
        throw new Error(`Missing rendered diagram ${file}`)
    }
}
console.log(`Rendered ${expected.length} diagrams into ${outDir}`)
