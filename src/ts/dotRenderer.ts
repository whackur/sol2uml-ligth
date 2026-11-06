const vizRenderStringSync: (
    dot: string,
) => string = require('@aduh95/viz.js/sync')

export function convertDot2Svg(dot: string): string {
    try {
        return vizRenderStringSync(dot)
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        throw new Error(`Failed to parse DOT input: ${message}`, { cause: err })
    }
}
