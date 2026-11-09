# Release process

Create stable patch, minor, or major releases from a clean local `main` checkout with `pnpm release patch`, `pnpm release minor`, or `pnpm release major`. The command requires `origin` to point to `whackur/sol2uml-ligth`, fetches `main` and tags, checks that local `main` exactly matches `origin/main`, then lets `npm version` create the version commit and `vX.Y.Z` tag. It pushes the commit and that tag to `main` in one atomic push without following unrelated local tags. A successful push starts the release workflow; npm and GitHub publication finish only after its checks pass. Prereleases and arbitrary version strings are not supported.

The `v*` tag workflow checks that the tag matches `package.json` and points to a commit on `origin/main`. It installs the frozen pnpm lockfile, runs lint, build, offline unit tests, and release-script tests, then packs one archive. The workflow installs that archive in a temporary consumer and checks that the published CLI renders SVG and PNG diagrams. The exact tested archive is passed to npm and attached to the GitHub Release. Releases are serialized, and version checks prevent npm and GitHub `latest` markers from moving backward. A new npm version is refused when the registry's `latest` tag already points to a higher stable version; an older GitHub Release recovered later is created without moving GitHub's `latest` marker backward.

## One-time npm setup

Before the first automated npm publish, configure npm trusted publishing for the `sol2uml-light` package in npmjs.com under **Package settings → Trusted Publisher**. Select **GitHub Actions** and set the owner/user to `whackur`, repository to `sol2uml-ligth`, and workflow filename to `release.yml`; leave the environment blank. Allow direct `npm publish` for this publisher. The repository workflow requests the OIDC `id-token: write` permission only in its npm publish job and uses Node.js 24 with npm 11.5.1 or newer. No long-lived npm token is used.

This repository does not configure the npm website setting for you. npm requires a newly created trusted publisher to make its first successful publish within two days, so create the setting when the first release is ready and run the tagged release workflow within that window. See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) for the current setup and requirements.

## Recovery

If the local command fails before `npm version`, fix the reported precondition and run it again. If the atomic push fails after `npm version`, the local release commit and tag are deliberately left in place. Inspect `git status`, `git log`, the local `vX.Y.Z` tag, and `origin/main`; only retry the exact push after confirming the remote has not moved:

```bash
git push --atomic --no-follow-tags origin HEAD:refs/heads/main refs/tags/vX.Y.Z:refs/tags/vX.Y.Z
```

Do not reset or force-push a release commit. If `origin/main` changed, reconcile the local release with the remote before proceeding.

If a tag workflow fails, rerun the failed workflow after resolving the cause. npm publishing compares the registry's `dist.integrity` with the tested archive: it skips a version only when the bytes match and fails if that immutable version already contains different bytes. A registry lookup error other than `E404` stops the workflow. GitHub Release recovery checks an existing release and asset; it verifies an existing archive, adds a missing archive without replacing assets, and does not create a duplicate release. The verify job's artifact is immutable and each full workflow attempt receives a distinct artifact name.
