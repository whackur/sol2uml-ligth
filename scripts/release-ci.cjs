#!/usr/bin/env node
'use strict'

const { spawnSync } = require('node:child_process')
const { createHash } = require('node:crypto')
const { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const REPOSITORY = 'whackur/sol2uml-ligth'
const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

function run(command, args, options = {}) {
    const result = spawnSync(command, args, {
        cwd: options.cwd || ROOT,
        encoding: 'utf8',
        maxBuffer: 8 * 1024 * 1024,
    })
    if (result.error) throw result.error
    if (result.status !== 0 && !options.allowFailure) {
        const detail = (result.stderr || result.stdout || '').trim()
        throw new Error(`${command} ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`)
    }
    return result
}

function expect(condition, message) {
    if (!condition) throw new Error(message)
}

function compareStableVersions(left, right) {
    expect(VERSION_PATTERN.test(left) && VERSION_PATTERN.test(right), 'Release comparison requires stable X.Y.Z versions')
    const leftParts = left.split('.').map(BigInt)
    const rightParts = right.split('.').map(BigInt)
    for (let index = 0; index < leftParts.length; index += 1) {
        if (leftParts[index] > rightParts[index]) return 1
        if (leftParts[index] < rightParts[index]) return -1
    }
    return 0
}

function isNotFound(result) {
    return /\bE404\b|HTTP 404|Not Found \(HTTP 404\)/i.test(`${result.stdout}\n${result.stderr}`)
}

function readPackage() {
    const packageJson = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
    expect(typeof packageJson.name === 'string', 'package.json must contain a package name')
    expect(VERSION_PATTERN.test(packageJson.version), 'Release tags require a stable X.Y.Z package version')
    expect(packageJson.repository?.url === `git+https://github.com/${REPOSITORY}.git`, `package.json repository.url must point to ${REPOSITORY}`)
    return packageJson
}

function getTag() {
    const tag = process.env.GITHUB_REF_NAME || ''
    expect(/^v\d+\.\d+\.\d+$/.test(tag), `Expected a stable version tag, found ${tag || '(empty)'}`)
    return tag
}

function appendOutputs(values) {
    expect(process.env.GITHUB_OUTPUT, 'GITHUB_OUTPUT is required for workflow output')
    const content = Object.entries(values)
        .map(([key, value]) => `${key}=${value}\n`)
        .join('')
    writeFileSync(process.env.GITHUB_OUTPUT, content, { flag: 'a' })
}

function verifyTag() {
    const packageJson = readPackage()
    const tag = getTag()
    const sha = process.env.GITHUB_SHA || ''
    expect(/^[0-9a-f]{40,64}$/i.test(sha), 'GITHUB_SHA must identify the tagged commit')
    expect(tag === `v${packageJson.version}`, `${tag} does not match package version ${packageJson.version}`)

    const remote = run('git', ['remote', 'get-url', 'origin']).stdout.trim()
    expect(
        /^https:\/\/github\.com\/whackur\/sol2uml-ligth(?:\.git)?$/i.test(remote),
        `origin must point to https://github.com/${REPOSITORY}.git`,
    )

    run('git', [
        'fetch',
        '--no-tags',
        'origin',
        `+refs/heads/main:refs/remotes/origin/main`,
        `+refs/tags/${tag}:refs/tags/${tag}`,
    ])
    const head = run('git', ['rev-parse', 'HEAD^{commit}']).stdout.trim()
    const taggedCommit = run('git', ['rev-parse', `refs/tags/${tag}^{commit}`]).stdout.trim()
    expect(head === sha && taggedCommit === sha, 'Checked out commit, event SHA, and published tag must match')

    const ancestry = run('git', ['merge-base', '--is-ancestor', sha, 'refs/remotes/origin/main'], { allowFailure: true })
    expect(ancestry.status === 0, ancestry.status === 1 ? `${tag} must point to a commit on origin/main` : 'Could not verify tag ancestry on origin/main')

    const artifactName = `release-${process.env.GITHUB_RUN_ID || 'local'}-${process.env.GITHUB_RUN_ATTEMPT || '1'}`
    appendOutputs({ tag, version: packageJson.version, sha, artifact_name: artifactName })
    process.stdout.write(`Verified ${tag} at ${sha} on origin/main\n`)
}

function packRelease(destination) {
    expect(destination && path.isAbsolute(destination), 'Pack destination must be an absolute path')
    const packageJson = readPackage()
    run('pnpm', ['run', 'permit'])
    const packed = run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', destination])
    const result = JSON.parse(packed.stdout)
    expect(Array.isArray(result) && result.length === 1, 'npm pack must produce exactly one package archive')
    const metadata = result[0]
    expect(metadata.name === packageJson.name && metadata.version === packageJson.version, 'Packed package name or version does not match package.json')
    expect(typeof metadata.filename === 'string' && path.basename(metadata.filename) === metadata.filename, 'npm pack returned an invalid archive name')
    const archive = path.join(destination, metadata.filename)
    expect(statSync(archive).size > 0, 'npm pack produced an empty archive')
    const integrity = `sha512-${createHash('sha512').update(readFileSync(archive)).digest('base64')}`
    expect(metadata.integrity === integrity, 'npm pack integrity does not match the archive bytes')
    appendOutputs({ filename: metadata.filename, integrity })
    process.stdout.write(`Packed ${metadata.name}@${metadata.version}: ${metadata.filename}\n`)
}

function npmVersionAtLeast(minimum) {
    const result = run('npm', ['--version'])
    const actual = result.stdout.trim()
    const actualParts = actual.split('.').map(Number)
    const minimumParts = minimum.split('.').map(Number)
    if (actualParts.length < 3 || actualParts.some((part) => !Number.isInteger(part))) return false
    for (let index = 0; index < 3; index += 1) {
        if (actualParts[index] > minimumParts[index]) return true
        if (actualParts[index] < minimumParts[index]) return false
    }
    return true
}

function archiveIntegrity(filename) {
    expect(statSync(filename).size > 0, 'Release archive is empty')
    return `sha512-${createHash('sha512').update(readFileSync(filename)).digest('base64')}`
}

function parseRegistryIntegrity(stdout) {
    const value = JSON.parse(stdout.trim())
    expect(typeof value === 'string' && value.startsWith('sha512-'), 'npm registry did not return a sha512 integrity value')
    return value
}

function publishArchive(filename, expectedIntegrity) {
    const packageJson = readPackage()
    const tag = getTag()
    expect(tag === `v${packageJson.version}`, 'Release tag changed before publish')
    expect(npmVersionAtLeast('11.5.1'), 'npm 11.5.1 or newer is required for trusted publishing')
    expect(archiveIntegrity(filename) === expectedIntegrity, 'Downloaded release archive does not match the tested artifact integrity')

    const packageSpec = `${packageJson.name}@${packageJson.version}`
    const existing = run('npm', ['view', packageSpec, 'dist.integrity', '--json'], { allowFailure: true })
    if (existing.status === 0) {
        const registryIntegrity = parseRegistryIntegrity(existing.stdout)
        expect(
            registryIntegrity === expectedIntegrity,
            `${packageSpec} already exists on npm with a different integrity; refusing to replace an immutable version`,
        )
        process.stdout.write(`${packageSpec} already has the tested integrity on npm; skipping publish\n`)
        return
    }
    if (!isNotFound(existing)) {
        throw new Error(`Could not check npm registry version ${packageSpec}: ${`${existing.stdout}\n${existing.stderr}`.trim()}`)
    }

    const latestResult = run('npm', ['view', packageJson.name, 'dist-tags.latest', '--json'], { allowFailure: true })
    let latestVersion
    if (latestResult.status === 0) {
        const latest = JSON.parse(latestResult.stdout.trim())
        if (latest !== null) {
            expect(typeof latest === 'string' && VERSION_PATTERN.test(latest), `npm latest dist-tag is not a stable X.Y.Z version: ${latest}`)
            latestVersion = latest
        }
    } else if (!isNotFound(latestResult)) {
        throw new Error(`Could not check npm latest version: ${`${latestResult.stdout}\n${latestResult.stderr}`.trim()}`)
    }

    if (latestVersion && compareStableVersions(latestVersion, packageJson.version) > 0) {
        throw new Error(`Cannot publish ${packageSpec}: npm latest is already ${latestVersion}`)
    }

    run('npm', ['publish', filename, '--access', 'public', '--ignore-scripts'], { cwd: ROOT })
    process.stdout.write(`Published ${packageSpec} from the verified archive\n`)
}

function verifyCheckout(tag, expectedSha) {
    expect(getTag() === tag, 'GitHub release tag does not match the validated tag')
    const head = run('git', ['rev-parse', 'HEAD^{commit}']).stdout.trim()
    const taggedCommit = run('git', ['rev-parse', `refs/tags/${tag}^{commit}`]).stdout.trim()
    expect(head === expectedSha && taggedCommit === expectedSha, 'Release checkout and tag must match the validated commit')
}

function getExistingRelease(tag) {
    const endpoint = `repos/${REPOSITORY}/releases/tags/${tag}`
    const result = run('gh', ['api', endpoint], { allowFailure: true })
    if (result.status === 0) return JSON.parse(result.stdout)
    const detail = `${result.stdout}\n${result.stderr}`
    if (isNotFound(result)) return undefined
    throw new Error(`Could not inspect GitHub Release ${tag}: ${detail.trim()}`)
}

function getLatestGithubReleaseVersion() {
    const result = run('gh', ['api', `repos/${REPOSITORY}/releases/latest`], { allowFailure: true })
    if (result.status !== 0) {
        if (isNotFound(result)) return undefined
        throw new Error(`Could not inspect the latest GitHub Release: ${`${result.stdout}\n${result.stderr}`.trim()}`)
    }
    const release = JSON.parse(result.stdout)
    const match = /^v(\d+\.\d+\.\d+)$/.exec(release.tag_name || '')
    expect(match, `Latest GitHub Release has unsupported tag ${release.tag_name}`)
    return match[1]
}

function verifyRelease(tag, filename, expectedIntegrity) {
    const release = getExistingRelease(tag)
    expect(release && release.tag_name === tag, `GitHub Release ${tag} is missing or points to another tag`)
    expect(!release.draft && !release.prerelease, `GitHub Release ${tag} must be a published stable release`)
    const asset = (release.assets || []).find((item) => item.name === filename)
    if (!asset) return false

    const downloadDir = mkdtempSync(path.join(tmpdir(), 'sol2uml-light-release-'))
    try {
        run('gh', ['release', 'download', tag, '--dir', downloadDir, '--pattern', filename])
        const downloaded = path.join(downloadDir, filename)
        expect(archiveIntegrity(downloaded) === expectedIntegrity, `GitHub Release asset ${filename} has different bytes`)
    } finally {
        rmSync(downloadDir, { recursive: true, force: true })
    }
    return true
}

function createOrCompleteGithubRelease(filename, expectedIntegrity, expectedSha) {
    const packageJson = readPackage()
    const tag = getTag()
    expect(tag === `v${packageJson.version}`, 'Release tag changed before GitHub Release creation')
    verifyCheckout(tag, expectedSha)
    const expectedFilename = `sol2uml-light-${packageJson.version}.tgz`
    expect(path.basename(filename) === expectedFilename, `Expected the verified archive ${expectedFilename}`)
    expect(archiveIntegrity(filename) === expectedIntegrity, 'Release archive does not match the tested artifact integrity')

    let release = getExistingRelease(tag)
    if (!release) {
        const latestVersion = getLatestGithubReleaseVersion()
        const latestOption = latestVersion && compareStableVersions(latestVersion, packageJson.version) > 0
            ? '--latest=false'
            : '--latest'
        run('gh', ['release', 'create', tag, filename, '--verify-tag', '--generate-notes', latestOption])
        release = getExistingRelease(tag)
    } else if (release.tag_name !== tag || release.draft || release.prerelease) {
        throw new Error(`Existing GitHub Release ${tag} does not match a published stable release`)
    }

    if (!verifyRelease(tag, expectedFilename, expectedIntegrity)) {
        run('gh', ['release', 'upload', tag, filename])
        expect(verifyRelease(tag, expectedFilename, expectedIntegrity), 'Uploaded GitHub Release archive could not be verified')
    }
    process.stdout.write(`GitHub Release ${tag} contains the verified ${expectedFilename}\n`)
}

function smokeArchive(filename) {
    const packageJson = readPackage()
    const workspace = mkdtempSync(path.join(tmpdir(), 'sol2uml-light-consumer-'))
    const consumer = path.join(workspace, 'consumer')
    const source = path.join(workspace, 'ReleaseSmoke.sol')
    mkdirSync(consumer)
    writeFileSync(path.join(consumer, 'package.json'), JSON.stringify({ name: 'sol2uml-light-release-consumer', version: '1.0.0', private: true }))
    writeFileSync(source, 'pragma solidity 0.8.38; contract ReleaseSmoke { uint256 public value; function setValue(uint256 nextValue) external { value = nextValue; } }')

    try {
        run('npm', ['install', '--prefix', consumer, '--no-audit', '--no-fund', filename])
        const installedPath = path.join(consumer, 'node_modules', packageJson.name, 'package.json')
        const installed = JSON.parse(readFileSync(installedPath, 'utf8'))
        const binPath = typeof installed.bin === 'string' ? installed.bin : installed.bin?.['sol2uml-light']
        expect(typeof binPath === 'string', 'Installed archive does not expose the sol2uml-light CLI')
        expect(statSync(path.join(path.dirname(installedPath), binPath)).size > 0, 'Installed CLI entry point is missing')
        const cli = path.join(consumer, 'node_modules', '.bin', 'sol2uml-light')
        expect((statSync(cli).mode & 0o111) !== 0, 'Installed CLI executable is not marked executable')

        for (const format of ['svg', 'png']) {
            const output = path.join(workspace, `release-smoke.${format}`)
            run(cli, ['class', source, '-f', format, '-o', output], { cwd: consumer })
            const bytes = readFileSync(output)
            if (format === 'svg') expect(bytes.toString('utf8').includes('<svg'), 'Installed CLI did not produce an SVG')
            else expect(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'Installed CLI did not produce a PNG')
        }
    } finally {
        rmSync(workspace, { recursive: true, force: true })
    }
    process.stdout.write('Installed archive rendered SVG and PNG diagrams\n')
}

function main() {
    const [command, ...args] = process.argv.slice(2)
    if (command === 'verify-tag' && args.length === 0) return verifyTag()
    if (command === 'pack' && args.length === 1) return packRelease(args[0])
    if (command === 'smoke' && args.length === 1) return smokeArchive(args[0])
    if (command === 'publish' && args.length === 2) return publishArchive(args[0], args[1])
    if (command === 'github-release' && args.length === 3) return createOrCompleteGithubRelease(args[0], args[1], args[2])
    throw new Error('Usage: node scripts/release-ci.cjs verify-tag|pack|smoke|publish|github-release ...')
}

if (require.main === module) {
    try {
        main()
    } catch (error) {
        process.stderr.write(`${error.message}\n`)
        process.exitCode = 1
    }
}

module.exports = { parseRegistryIntegrity, npmVersionAtLeast, archiveIntegrity }
