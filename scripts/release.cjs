#!/usr/bin/env node
'use strict'

const { spawnSync } = require('node:child_process')
const { readFileSync } = require('node:fs')
const path = require('node:path')

const REPOSITORY = 'whackur/sol2uml-ligth'
const ROOT = path.resolve(__dirname, '..')

function run(command, args, options = {}) {
    const result = spawnSync(command, args, {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: options.inherit ? 'inherit' : 'pipe',
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

function isExpectedRemote(value) {
    const normalized = value
        .trim()
        .replace(/^git@github\.com:/i, 'https://github.com/')
        .replace(/\.git$/i, '')

    try {
        const url = new URL(normalized)
        return (
            url.hostname.toLowerCase() === 'github.com' &&
            (url.protocol === 'https:' || url.protocol === 'ssh:') &&
            url.pathname.replace(/\/$/, '').toLowerCase() === `/${REPOSITORY}`
        )
    } catch {
        return false
    }
}

function bumpVersion(version, releaseType) {
    const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version)
    expect(match, `package.json version must be a stable X.Y.Z version; found ${version}`)

    let [major, minor, patch] = match.slice(1).map(BigInt)
    if (releaseType === 'major') {
        major += 1n
        minor = 0n
        patch = 0n
    } else if (releaseType === 'minor') {
        minor += 1n
        patch = 0n
    } else {
        patch += 1n
    }
    return `${major}.${minor}.${patch}`
}

function main() {
    const [releaseType, ...extra] = process.argv.slice(2)
    if (!['patch', 'minor', 'major'].includes(releaseType) || extra.length > 0) {
        throw new Error('Usage: pnpm release patch|minor|major')
    }

    const status = run('git', ['status', '--porcelain=v1', '--untracked-files=all']).stdout
    expect(status.trim() === '', 'Working tree must be clean, including untracked files')
    expect(run('git', ['branch', '--show-current']).stdout.trim() === 'main', 'Release must run from the main branch')

    const fetchUrls = run('git', ['remote', 'get-url', '--all', 'origin']).stdout.trim().split(/\r?\n/)
    const pushUrls = run('git', ['remote', 'get-url', '--push', '--all', 'origin']).stdout.trim().split(/\r?\n/)
    expect(
        fetchUrls.length > 0 &&
            pushUrls.length > 0 &&
            [...fetchUrls, ...pushUrls].every(isExpectedRemote),
        `origin must point to https://github.com/${REPOSITORY}.git for fetch and push`,
    )

    run('git', ['fetch', '--tags', 'origin', '+refs/heads/main:refs/remotes/origin/main'], { inherit: true })
    const head = run('git', ['rev-parse', 'HEAD']).stdout.trim()
    const remoteMain = run('git', ['rev-parse', 'refs/remotes/origin/main']).stdout.trim()
    expect(head === remoteMain, 'Local main must match origin/main before releasing')

    const packagePath = path.join(ROOT, 'package.json')
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'))
    const version = bumpVersion(packageJson.version, releaseType)
    const tag = `v${version}`
    const localTag = run('git', ['show-ref', '--verify', '--quiet', `refs/tags/${tag}`], { allowFailure: true })
    expect(localTag.status !== 0, `Local tag ${tag} already exists`)

    const remoteTag = run('git', ['ls-remote', '--exit-code', '--refs', 'origin', `refs/tags/${tag}`], { allowFailure: true })
    expect(remoteTag.status === 2, remoteTag.status === 0 ? `Remote tag ${tag} already exists` : `Could not check remote tag ${tag}`)

    run('npm', ['version', releaseType, '-m', 'chore(release): %s'], { inherit: true })
    const releasedVersion = JSON.parse(readFileSync(packagePath, 'utf8')).version
    expect(releasedVersion === version, `npm version created ${releasedVersion}; expected ${version}`)

    try {
        run('git', ['push', '--atomic', '--no-follow-tags', 'origin', 'HEAD:refs/heads/main', `refs/tags/${tag}:refs/tags/${tag}`], { inherit: true })
    } catch (error) {
        throw new Error(
            `${error.message}\nThe local release commit and tag were kept. Inspect the remote before retrying; do not reset or force-push.`,
        )
    }

    process.stdout.write(`Pushed release commit for ${packageJson.name}@${version} with tag ${tag}\n`)
}

if (require.main === module) {
    try {
        main()
    } catch (error) {
        process.stderr.write(`${error.message}\n`)
        process.exitCode = 1
    }
}

module.exports = { bumpVersion, isExpectedRemote }
