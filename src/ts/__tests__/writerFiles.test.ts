import { mkdtemp, readFile, rm } from 'fs/promises'
import os from 'os'
import path from 'path'
import { convertDot2Svg, writeOutputFiles, writePng } from '../output/writer'
import { renderSvg } from '../output/svgRenderer'

const dot = `digraph G {
    graph [bgcolor="white"];
    node [shape=box];
    Contract [label="UML contract"];
}`

describe('output rendering', () => {
    let outputDirectory: string

    beforeEach(async () => {
        outputDirectory = await mkdtemp(
            path.join(os.tmpdir(), 'sol2uml-light-'),
        )
    })

    afterEach(async () => {
        await rm(outputDirectory, { recursive: true, force: true })
    })

    test('renders SVG labels to a PNG with the SVG dimensions', () => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="80">
            <rect width="320" height="80" fill="white" />
            <text x="12" y="48" font-family="sans-serif" font-size="24" fill="black">UML contract</text>
        </svg>`

        const rendered = renderSvg(svg)
        const png = rendered.asPng()

        expect(rendered.width).toBe(320)
        expect(rendered.height).toBe(80)
        expect(png.subarray(0, 8)).toEqual(
            Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        )

        const pixels = rendered.pixels
        let darkPixels = 0
        for (let index = 0; index < pixels.length; index += 4) {
            if (
                pixels[index] < 96 &&
                pixels[index + 1] < 96 &&
                pixels[index + 2] < 96
            ) {
                darkPixels += 1
            }
        }
        expect(darkPixels).toBeGreaterThan(10)
    })

    test('writes SVG by default', async () => {
        const svgFilename = path.join(outputDirectory, 'default.svg')
        await writeOutputFiles(dot, 'default', undefined, svgFilename)

        expect(await readFile(svgFilename, 'utf8')).toContain('UML contract')
        await expect(
            readFile(path.join(outputDirectory, 'default.png')),
        ).rejects.toThrow()
    })

    test('writes only DOT when requested', async () => {
        const filename = path.join(outputDirectory, 'dot-only.svg')
        await writeOutputFiles(dot, 'dot-only', 'dot', filename)

        expect(
            await readFile(path.join(outputDirectory, 'dot-only.dot'), 'utf8'),
        ).toBe(dot)
        await expect(
            readFile(path.join(outputDirectory, 'dot-only.svg')),
        ).rejects.toThrow()
    })

    test('writes DOT, SVG, and PNG for all output', async () => {
        const filename = path.join(outputDirectory, 'all.svg')
        await writeOutputFiles(dot, 'all', 'all', filename)

        const svg = await readFile(
            path.join(outputDirectory, 'all.svg'),
            'utf8',
        )
        const png = await readFile(path.join(outputDirectory, 'all.png'))
        const dotOutput = await readFile(
            path.join(outputDirectory, 'all.dot'),
            'utf8',
        )
        expect(svg).toContain('UML contract')
        expect(dotOutput).toBe(dot)
        expect(png.subarray(0, 8)).toEqual(
            Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        )
    })

    test('reports DOT parse, SVG render, and output write failures', async () => {
        expect(() => convertDot2Svg('not a dot graph')).toThrow(
            'Failed to parse DOT input',
        )
        await expect(
            writePng(
                '<svg><invalid',
                path.join(outputDirectory, 'invalid.png'),
            ),
        ).rejects.toThrow('Failed to generate PNG file')
        await expect(
            writeOutputFiles(
                dot,
                'missing',
                'svg',
                path.join(outputDirectory, 'missing', 'out.svg'),
            ),
        ).rejects.toThrow('Failed to write SVG file')
    })
})
