# sol2uml-light

## Package boundary

- This CLI is a Node.js 24+ CommonJS package. Keep `package.json` set to `type: commonjs` and keep the TypeScript compiler on Node16 module and resolution behavior so it remains isolated from the toolkit's ESM package boundary.
- Keep `ts-node.experimentalResolver` enabled so direct source-mode CLI runs resolve local `.js` imports to TypeScript sources.
- `src/ts/` is maintained source and `lib/` is generated output. Make changes in source and regenerate `lib/` with the build script; do not hand-edit generated files.

## Compatibility

- Keep Commander at version 12 or lower unless all multi-character short flags and their documented invocations are migrated together. Commander 13 rejects flags such as `-hv`, `-sf`, and `-bc`.
- `@openzeppelin/contracts` is a development-only fixture source for diagrams and tests. Keep the committed dependency and lockfile version stable unless fixture changes are intentional.

## Rendering

- SVG remains the default output. PNG rendering uses `@resvg/resvg-js`; do not add a browser-based renderer or browser download step.
- Keep DOT/SVG/PNG transformations free of file I/O and keep filesystem writes in the output writer.
