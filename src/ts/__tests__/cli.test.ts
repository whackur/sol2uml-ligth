import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { spawnSync } from 'child_process'
import { getPackageVersion } from '../cli/packageVersion.js'

const cliPath = resolve(__dirname, '../../../lib/sol2uml.js')

const runCli = (args: string[], cwd?: string) =>
    spawnSync(process.execPath, [cliPath, ...args], {
        cwd,
        encoding: 'utf8',
    })

describe('CLI compatibility', () => {
    test('keeps global help, aliases, environment labels, and package version', () => {
        const help = runCli(['--help'])

        expect(help.status).toBe(0)
        expect(help.stdout).toContain('-sf, --subfolders <value>')
        expect(help.stdout).toContain('-bc, --backColor <color>')
        expect(help.stdout).toContain('env: ETH_NETWORK')

        const version = runCli(['--version'])
        expect(version.status).toBe(0)
        expect(version.stdout.trim()).toBe(
            require('../../../package.json').version,
        )
        expect(getPackageVersion()).toBe(
            require('../../../package.json').version,
        )
    })

    test('keeps class aliases and writes a local DOT diagram offline', () => {
        const workspace = mkdtempSync(join(tmpdir(), 'sol2uml-light-cli-'))
        const contractFile = join(workspace, 'Vault.sol')
        const outputFile = join(workspace, 'vault.dot')

        try {
            writeFileSync(
                contractFile,
                'pragma solidity 0.8.38; contract Vault { uint256 public value; function setValue(uint256 next) public { value = next; } }',
            )

            const result = runCli(
                [
                    '-f',
                    'dot',
                    '-bc',
                    'white',
                    '-hv',
                    '-o',
                    outputFile,
                    contractFile,
                ],
                workspace,
            )

            expect(result.status).toBe(0)
            expect(readFileSync(outputFile, 'utf8')).toContain(
                'digraph UmlClassDiagram',
            )
            expect(readFileSync(outputFile, 'utf8')).toContain('setValue')
            expect(readFileSync(outputFile, 'utf8')).not.toContain('value')
        } finally {
            rmSync(workspace, { recursive: true, force: true })
        }
    })
})
