# sol2uml-light

## Package boundary

- This CLI is a Node.js 24+ CommonJS package. Keep `package.json` set to `type: commonjs` and keep the TypeScript compiler on Node16 module and resolution behavior so it remains isolated from the toolkit's ESM package boundary.
- Keep `ts-node.experimentalResolver` enabled so direct source-mode CLI runs resolve local `.js` imports to TypeScript sources.
- `src/ts/` is maintained source and `lib/` is generated output. Make changes in source and regenerate `lib/` with the build script; do not hand-edit generated files.

## Compatibility

- Keep Commander at version 12 or lower unless all multi-character short flags and their documented invocations are migrated together. Commander 13 rejects flags such as `-hv`, `-sf`, and `-bc`.
- Keep `@noble/hashes` on 1.x; 2.x is ESM-only and cannot be imported under the Node16 CommonJS setup. Do not reintroduce ethers, viem, axios, or klaw for helpers already covered by `src/ts/utils/evm.ts`, `src/ts/network/`, or the readdir-based file walker; see the README "Runtime dependencies" section.
- Never put node or explorer URLs in errors or logs without `redactUrl`; they commonly embed API keys.
- `@openzeppelin/contracts` is a development-only fixture source for diagrams and tests. Keep the committed dependency and lockfile version stable unless fixture changes are intentional.

## Source layout

- Implementations live in responsibility folders under `src/ts/`. Top-level modules and `utils/` re-export files are public `lib/*` deep-import paths kept as one-line facades; keep them when moving code, and import implementations directly inside the source.

## Rendering

- SVG remains the default output. PNG rendering uses `@resvg/resvg-js`; do not add a browser-based renderer or browser download step.
- Keep DOT/SVG/PNG transformations free of file I/O and keep filesystem writes in the output writer.
