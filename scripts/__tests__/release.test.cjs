'use strict'

const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const path = require('node:path')
const { after, test } = require('node:test')

const releaseScript = path.resolve(__dirname, '../release.cjs')
const releaseCiScript = path.resolve(__dirname, '../release-ci.cjs')
const workspaces = []

after(() => {
    for (const workspace of workspaces) rmSync(workspace, { recursive: true, force: true })
})

function workspace() {
    const directory = mkdtempSync(path.join(tmpdir(), 'sol2uml-light-release-test-'))
    workspaces.push(directory)
    return directory
}

function installExecutable(file, source) {
    writeFileSync(file, `#!/usr/bin/env node\n${source}`)
    chmodSync(file, 0o755)
}

function createReleaseFixture(options = {}) {
    const directory = workspace()
    const scripts = path.join(directory, 'scripts')
    const bin = path.join(directory, 'bin')
    mkdirSync(scripts)
    mkdirSync(bin)
    const packagePath = path.join(directory, 'package.json')
    const logPath = path.join(directory, 'calls.jsonl')
    writeFileSync(packagePath, JSON.stringify({ name: 'sol2uml-light', version: '0.1.0' }))
    const copiedScript = path.join(scripts, 'release.cjs')
    writeFileSync(copiedScript, readFileSync(releaseScript))

    installExecutable(path.join(bin, 'git'), `
const fs = require('node:fs')
const [command, ...args] = process.argv.slice(2)
fs.appendFileSync(process.env.MOCK_LOG, JSON.stringify({ command, args }) + '\\n')
const output = (value) => process.stdout.write(value + '\\n')
if (command === 'status') { if (process.env.MOCK_DIRTY === '1') output('?? dirty.txt'); process.exit(0) }
if (command === 'branch') { output(process.env.MOCK_BRANCH || 'main'); process.exit(0) }
if (command === 'remote' && args[0] === 'get-url') { output(process.env.MOCK_REMOTE || 'https://github.com/whackur/sol2uml-ligth.git'); process.exit(0) }
if (command === 'fetch') process.exit(0)
if (command === 'rev-parse') { output(args[0] === 'HEAD' ? (process.env.MOCK_HEAD || 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa') : (process.env.MOCK_REMOTE_MAIN || 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')); process.exit(0) }
if (command === 'show-ref') process.exit(process.env.MOCK_LOCAL_TAG === '1' ? 0 : 1)
if (command === 'ls-remote') process.exit(process.env.MOCK_REMOTE_TAG === '1' ? 0 : 2)
if (command === 'push') { if (process.env.MOCK_PUSH_FAIL === '1') { process.stderr.write('simulated push rejection'); process.exit(1) } process.exit(0) }
process.stderr.write('unexpected git command: ' + command + ' ' + args.join(' '))
process.exit(97)
`)

    installExecutable(path.join(bin, 'npm'), `
const fs = require('node:fs')
const [command, ...args] = process.argv.slice(2)
fs.appendFileSync(process.env.MOCK_LOG, JSON.stringify({ command, args }) + '\\n')
if (command === 'version') {
    if (process.env.MOCK_NPM_FAIL === '1') process.exit(1)
    const packagePath = process.env.MOCK_PACKAGE
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
    const parts = pkg.version.split('.').map(Number)
    if (args[0] === 'patch') parts[2] += 1
    if (args[0] === 'minor') { parts[1] += 1; parts[2] = 0 }
    if (args[0] === 'major') { parts[0] += 1; parts[1] = 0; parts[2] = 0 }
    pkg.version = parts.join('.')
    fs.writeFileSync(packagePath, JSON.stringify(pkg))
    process.stdout.write('v' + pkg.version + '\\n')
    process.exit(0)
}
process.stderr.write('unexpected npm command: ' + command)
process.exit(97)
`)
    return { directory, bin, packagePath, logPath, copiedScript, options }
}

function runRelease(fixture, args = ['patch']) {
    return spawnSync(process.execPath, [fixture.copiedScript, ...args], {
        encoding: 'utf8',
        env: {
            ...process.env,
            PATH: `${fixture.bin}:${process.env.PATH}`,
            MOCK_LOG: fixture.logPath,
            MOCK_PACKAGE: fixture.packagePath,
            ...fixture.options,
        },
    })
}

function readCalls(logPath) {
    if (!existsSync(logPath)) return []
    return readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line))
}

test('release command bumps, commits through npm, and performs one atomic push', () => {
    const fixture = createReleaseFixture()
    const result = runRelease(fixture)

    assert.equal(result.status, 0, result.stderr)
    assert.equal(JSON.parse(readFileSync(fixture.packagePath, 'utf8')).version, '0.1.1')
    const calls = readCalls(fixture.logPath)
    assert.deepEqual(calls.find((call) => call.command === 'push').args, [
        '--atomic',
        '--no-follow-tags',
        'origin',
        'HEAD:refs/heads/main',
        'refs/tags/v0.1.1:refs/tags/v0.1.1',
    ])
    assert.deepEqual(calls.find((call) => call.command === 'version').args, [
        'patch',
        '-m',
        'chore(release): %s',
    ])
})

test('release command rejects malformed arguments before touching git', () => {
    const fixture = createReleaseFixture()
    const result = runRelease(fixture, ['patch', 'extra'])

    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /Usage: pnpm release patch\|minor\|major/)
    assert.deepEqual(readCalls(fixture.logPath), [])
})

test('release command rejects dirty trees, wrong branches, and a stale main', () => {
    for (const options of [
        { MOCK_DIRTY: '1' },
        { MOCK_BRANCH: 'feature' },
        { MOCK_REMOTE_MAIN: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
    ]) {
        const fixture = createReleaseFixture(options)
        const result = runRelease(fixture)
        assert.notEqual(result.status, 0)
        assert.equal(readCalls(fixture.logPath).some((call) => call.command === 'version'), false)
    }
})

test('release command rejects a mismatched origin and an existing target tag', () => {
    for (const options of [
        { MOCK_REMOTE: 'https://example.com/elsewhere/repo.git' },
        { MOCK_REMOTE_TAG: '1' },
        { MOCK_LOCAL_TAG: '1' },
    ]) {
        const fixture = createReleaseFixture(options)
        const result = runRelease(fixture)
        assert.notEqual(result.status, 0)
        assert.equal(readCalls(fixture.logPath).some((call) => call.command === 'version'), false)
    }
})

function createNpmFixture(mode, integrity, latestVersion) {
    const directory = workspace()
    const bin = path.join(directory, 'bin')
    mkdirSync(bin)
    const logPath = path.join(directory, 'npm.jsonl')
    const version = JSON.parse(readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')).version
    const archive = path.join(directory, `sol2uml-light-${version}.tgz`)
    writeFileSync(archive, 'immutable archive bytes')
    installExecutable(path.join(bin, 'npm'), `
const fs = require('node:fs')
const [command, ...args] = process.argv.slice(2)
fs.appendFileSync(process.env.MOCK_LOG, JSON.stringify({ command, args }) + '\\n')
if (command === '--version') { process.stdout.write('11.5.1\\n'); process.exit(0) }
if (command === 'view') {
    if (args[1] === 'dist.integrity') {
        if (process.env.MOCK_MODE === 'missing') { process.stderr.write('npm error code E404\\n'); process.exit(1) }
        if (process.env.MOCK_MODE === 'error') { process.stderr.write('npm error code ENETUNREACH\\n'); process.exit(1) }
        process.stdout.write(JSON.stringify(process.env.MOCK_INTEGRITY) + '\\n')
        process.exit(0)
    }
    if (args[1] === 'dist-tags.latest') {
        if (!process.env.MOCK_LATEST) { process.stderr.write('npm error code E404\\n'); process.exit(1) }
        process.stdout.write(JSON.stringify(process.env.MOCK_LATEST) + '\\n')
        process.exit(0)
    }
    process.exit(98)
}
if (command === 'publish') { process.exit(0) }
process.exit(97)
`)
    return { directory, bin, logPath, archive, mode, integrity, latestVersion }
}

function runPublish(fixture, expectedIntegrity) {
    return spawnSync(process.execPath, [releaseCiScript, 'publish', fixture.archive, expectedIntegrity], {
        cwd: path.resolve(__dirname, '../..'),
        encoding: 'utf8',
        env: {
            ...process.env,
            PATH: `${fixture.bin}:${process.env.PATH}`,
            GITHUB_REF_NAME: `v${JSON.parse(readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')).version}`,
            GITHUB_RUN_ID: 'test',
            MOCK_LOG: fixture.logPath,
            MOCK_MODE: fixture.mode,
            MOCK_INTEGRITY: fixture.integrity,
            MOCK_LATEST: fixture.latestVersion || '',
        },
    })
}

test('npm rerun skips an identical immutable package and rejects different bytes', () => {
    const current = createNpmFixture('existing', 'unused')
    const expectedIntegrity = require(releaseCiScript).archiveIntegrity(current.archive)
    current.integrity = expectedIntegrity
    const skipped = runPublish(current, expectedIntegrity)
    assert.equal(skipped.status, 0, skipped.stderr)
    assert.equal(readCalls(current.logPath).some((call) => call.command === 'publish'), false)

    const mismatch = createNpmFixture('existing', 'sha512-different')
    const rejected = runPublish(mismatch, require(releaseCiScript).archiveIntegrity(mismatch.archive))
    assert.notEqual(rejected.status, 0)
    assert.match(rejected.stderr, /different integrity/)
    assert.equal(readCalls(mismatch.logPath).some((call) => call.command === 'publish'), false)
})

test('npm rerun publishes only when the exact version is absent and fails closed on registry errors', () => {
    const missing = createNpmFixture('missing')
    const missingIntegrity = require(releaseCiScript).archiveIntegrity(missing.archive)
    const published = runPublish(missing, missingIntegrity)
    assert.equal(published.status, 0, published.stderr)
    assert.equal(readCalls(missing.logPath).some((call) => call.command === 'publish'), true)

    const unavailable = createNpmFixture('error')
    const failed = runPublish(unavailable, require(releaseCiScript).archiveIntegrity(unavailable.archive))
    assert.notEqual(failed.status, 0)
    assert.match(failed.stderr, /Could not check npm registry/)
    assert.equal(readCalls(unavailable.logPath).some((call) => call.command === 'publish'), false)

    const historical = createNpmFixture('missing', undefined, '9.9.9')
    const refused = runPublish(historical, require(releaseCiScript).archiveIntegrity(historical.archive))
    assert.notEqual(refused.status, 0)
    assert.match(refused.stderr, /npm latest is already 9\.9\.9/)
    assert.equal(readCalls(historical.logPath).some((call) => call.command === 'publish'), false)
})

function createCiFixture() {
    const directory = workspace()
    const scripts = path.join(directory, 'scripts')
    const bin = path.join(directory, 'bin')
    mkdirSync(scripts)
    mkdirSync(bin)
    const version = JSON.parse(readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')).version
    const packagePath = path.join(directory, 'package.json')
    const logPath = path.join(directory, 'git.jsonl')
    const outputPath = path.join(directory, 'outputs')
    const copiedScript = path.join(scripts, 'release-ci.cjs')
    writeFileSync(packagePath, JSON.stringify({
        name: 'sol2uml-light',
        version,
        repository: { url: 'git+https://github.com/whackur/sol2uml-ligth.git' },
    }))
    writeFileSync(copiedScript, readFileSync(releaseCiScript))
    installExecutable(path.join(bin, 'git'), `
const fs = require('node:fs')
const [command, ...args] = process.argv.slice(2)
fs.appendFileSync(process.env.MOCK_LOG, JSON.stringify({ command, args }) + '\\n')
if (command === 'remote' && args[0] === 'get-url') { process.stdout.write('https://github.com/whackur/sol2uml-ligth.git\\n'); process.exit(0) }
if (command === 'fetch') process.exit(0)
if (command === 'rev-parse') { process.stdout.write((process.env.MOCK_SHA || '') + '\\n'); process.exit(0) }
if (command === 'merge-base') process.exit(process.env.MOCK_ANCESTOR === '1' ? 0 : 1)
process.exit(97)
`)
    return { directory, bin, version, packagePath, logPath, outputPath, copiedScript }
}

function runCi(fixture, command, args = [], options = {}) {
    return spawnSync(process.execPath, [fixture.copiedScript, command, ...args], {
        cwd: fixture.directory,
        encoding: 'utf8',
        env: {
            ...process.env,
            PATH: `${fixture.bin}:${process.env.PATH}`,
            GITHUB_REF_NAME: options.tag || `v${fixture.version}`,
            GITHUB_SHA: options.sha || 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            GITHUB_OUTPUT: fixture.outputPath,
            GITHUB_RUN_ID: '42',
            GITHUB_RUN_ATTEMPT: '1',
            MOCK_LOG: fixture.logPath,
            MOCK_SHA: options.mockSha || options.sha || 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            MOCK_ANCESTOR: options.ancestor === false ? '0' : '1',
            ...options.env,
        },
    })
}

test('tag verification binds the event SHA to the matching package version on main', () => {
    const valid = createCiFixture()
    const result = runCi(valid, 'verify-tag')
    assert.equal(result.status, 0, result.stderr)
    assert.match(readFileSync(valid.outputPath, 'utf8'), new RegExp(`tag=v${valid.version}`))
    assert.match(readFileSync(valid.outputPath, 'utf8'), /artifact_name=release-42-1/)

    for (const options of [
        { tag: 'v9.9.9' },
        { sha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', mockSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
        { ancestor: false },
    ]) {
        const invalid = createCiFixture()
        const rejected = runCi(invalid, 'verify-tag', [], options)
        assert.notEqual(rejected.status, 0)
    }
})

function createGithubFixture(initialRelease, latestMode, downloadedContent) {
    const fixture = createCiFixture()
    const statePath = path.join(fixture.directory, 'release.json')
    const versionedFilename = `sol2uml-light-${fixture.version}.tgz`
    const archive = path.join(fixture.directory, versionedFilename)
    const archiveContent = 'verified release archive bytes'
    writeFileSync(archive, archiveContent)
    if (initialRelease) {
        writeFileSync(statePath, JSON.stringify({
            tag_name: `v${fixture.version}`,
            draft: false,
            prerelease: false,
            assets: initialRelease === 'asset' ? [{ name: versionedFilename }] : [],
        }))
    }

    installExecutable(path.join(fixture.bin, 'gh'), `
const fs = require('node:fs')
const path = require('node:path')
const [command, ...args] = process.argv.slice(2)
fs.appendFileSync(process.env.MOCK_GH_LOG, JSON.stringify({ command, args }) + '\\n')
const statePath = process.env.MOCK_RELEASE_STATE
const readState = () => fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : undefined
const writeState = (state) => fs.writeFileSync(statePath, JSON.stringify(state))
if (command === 'api' && args[0].endsWith('/releases/latest')) {
    if (process.env.MOCK_LATEST_MODE === 'error') { process.stderr.write('HTTP 500'); process.exit(1) }
    if (process.env.MOCK_LATEST_MODE === 'missing') { process.stderr.write('HTTP 404 Not Found'); process.exit(1) }
    process.stdout.write(JSON.stringify({ tag_name: process.env.MOCK_LATEST_TAG }) + '\\n')
    process.exit(0)
}
if (command === 'api') {
    const state = readState()
    if (!state) { process.stderr.write('HTTP 404 Not Found'); process.exit(1) }
    process.stdout.write(JSON.stringify(state) + '\\n')
    process.exit(0)
}
if (command === 'release' && args[0] === 'create') {
    writeState({ tag_name: args[1], draft: false, prerelease: false, assets: [] })
    process.exit(0)
}
if (command === 'release' && args[0] === 'upload') {
    const state = readState()
    state.assets.push({ name: process.env.MOCK_FILENAME })
    writeState(state)
    process.exit(0)
}
if (command === 'release' && args[0] === 'download') {
    const directory = args[args.indexOf('--dir') + 1]
    fs.writeFileSync(path.join(directory, process.env.MOCK_FILENAME), process.env.MOCK_DOWNLOAD_CONTENT)
    process.exit(0)
}
process.exit(97)
`)

    const result = runCi(fixture, 'github-release', [archive, require(releaseCiScript).archiveIntegrity(archive), 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'], {
        tag: `v${fixture.version}`,
        env: {
            MOCK_GH_LOG: path.join(fixture.directory, 'gh.jsonl'),
            MOCK_RELEASE_STATE: statePath,
            MOCK_FILENAME: versionedFilename,
            MOCK_DOWNLOAD_CONTENT: downloadedContent,
            MOCK_LATEST_MODE: latestMode,
            MOCK_LATEST_TAG: 'v9.9.9',
        },
    })
    return { ...fixture, archive, archiveContent, latestMode, result, statePath, versionedFilename, downloadedContent }
}

test('GitHub Release recovery uploads only a missing asset and verifies existing asset bytes', () => {
    const missingAsset = createGithubFixture('missing-asset', 'missing', 'verified release archive bytes')
    assert.equal(missingAsset.result.status, 0, missingAsset.result.stderr)
    const missingCalls = readCalls(path.join(missingAsset.directory, 'gh.jsonl'))
    assert.ok(JSON.parse(readFileSync(missingAsset.statePath, 'utf8')).assets.some((asset) => asset.name === missingAsset.versionedFilename))

    const mismatchedAsset = createGithubFixture('asset', 'missing', 'different bytes')
    assert.notEqual(mismatchedAsset.result.status, 0)
    assert.match(mismatchedAsset.result.stderr, /different bytes/)
    const ghCalls = readCalls(path.join(mismatchedAsset.directory, 'gh.jsonl'))
    assert.equal(ghCalls.some((call) => call.command === 'release' && call.args[0] === 'upload'), false)
    assert.equal(missingCalls.some((call) => call.command === 'release' && call.args[0] === 'upload'), true)
})

test('GitHub Release historical reruns stay non-latest and latest lookup errors block creation', () => {
    const historical = createGithubFixture(undefined, 'present', 'verified release archive bytes')
    assert.equal(historical.result.status, 0, historical.result.stderr)
    const created = readCalls(path.join(historical.directory, 'gh.jsonl'))
    const create = created.find((call) => call.command === 'release' && call.args[0] === 'create')
    assert.ok(create.args.includes('--latest=false'))

    const unavailable = createGithubFixture(undefined, 'error', 'verified release archive bytes')
    assert.notEqual(unavailable.result.status, 0)
    assert.match(unavailable.result.stderr, /Could not inspect the latest GitHub Release/)
    const calls = readCalls(path.join(unavailable.directory, 'gh.jsonl'))
    assert.equal(calls.some((call) => call.command === 'release' && call.args[0] === 'create'), false)
})
