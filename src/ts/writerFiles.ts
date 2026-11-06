import { lstat, writeFile } from 'fs/promises'
import path from 'path'
import { convertDot2Svg } from './dotRenderer'
import { renderSvg } from './svgRenderer'

const debug = require('debug')('sol2uml-light')

export type OutputFormats = 'svg' | 'png' | 'dot' | 'all'

/**
 * Writes output files to the file system based on the provided input and options.
 * @param dot The input string in DOT format.
 * @param contractName The name of the contract.
 * @param outputFormat The format of the output file. choices: svg, png, dot or all. default: svg
 * @param outputFilename optional filename of the output file.
 */
export const writeOutputFiles = async (
    dot: string,
    contractName: string,
    outputFormat: OutputFormats = 'svg',
    outputFilename?: string,
): Promise<void> => {
    const outputExt = outputFormat === 'all' ? 'svg' : outputFormat

    if (!outputFilename) {
        outputFilename =
            path.join(process.cwd(), contractName) + '.' + outputExt
    } else {
        try {
            const folderOrFile = await lstat(outputFilename)
            if (folderOrFile.isDirectory()) {
                outputFilename =
                    path.join(process.cwd(), outputFilename, contractName) +
                    '.' +
                    outputExt
            }
        } catch {
            // A nonexistent output path is treated as a file name.
        }
    }

    if (outputFormat === 'dot' || outputFormat === 'all') {
        await writeDot(dot, outputFilename)
        if (outputFormat === 'dot') {
            return
        }
    }

    const svg = convertDot2Svg(dot)

    if (outputFormat === 'svg' || outputFormat === 'all') {
        await writeSVG(svg, outputFilename, outputFormat)
    }

    if (outputFormat === 'png' || outputFormat === 'all') {
        await writePng(svg, outputFilename)
    }
}

export { convertDot2Svg }

export function writeSourceCode(
    code: string,
    filename = 'source',
    extension = '.sol',
): Promise<void> {
    const fileExtension = path.extname(filename)
    const outputFile =
        fileExtension === extension ? filename : filename + extension
    debug(`About to write source code to file ${outputFile}`)

    return writeFile(outputFile, code)
        .then(() => {
            console.log(`Source code written to ${outputFile}`)
        })
        .catch((err) => {
            throw new Error(
                `Failed to write source code to file ${outputFile}`,
                {
                    cause: err,
                },
            )
        })
}

export function writeDot(dot: string, filename: string): Promise<void> {
    const dotFilename = changeFileExtension(filename, 'dot')
    debug(`About to write Dot file to ${dotFilename}`)

    return writeFile(dotFilename, dot)
        .then(() => {
            console.log(`Dot file written to ${dotFilename}`)
        })
        .catch((err) => {
            throw new Error(`Failed to write Dot file to ${dotFilename}`, {
                cause: err,
            })
        })
}

/**
 * Writes an SVG file to the file system.
 * @param svg The SVG input to be written to the file system.
 * @param svgFilename The desired file name for the SVG file. default: classDiagram.svg
 * @param outputFormats The format of the output file. choices: svg, png, dot or all. default: svg
 * @throws Error - If there is an error writing the SVG file.
 */
export function writeSVG(
    svg: string,
    svgFilename = 'classDiagram.svg',
    outputFormats: OutputFormats = 'svg',
): Promise<void> {
    debug(`About to write SVG file to ${svgFilename}`)

    if (outputFormats === 'png') {
        const parsedFile = path.parse(svgFilename)
        svgFilename = path.join(
            parsedFile.dir || process.cwd(),
            parsedFile.name + '.svg',
        )
    }

    return writeFile(svgFilename, svg)
        .then(() => {
            console.log(`Generated svg file ${svgFilename}`)
        })
        .catch((err) => {
            throw new Error(`Failed to write SVG file to ${svgFilename}`, {
                cause: err,
            })
        })
}

/**
 * Converts an SVG input to a PNG file and writes it to the file system.
 * @param svg The SVG input to be converted to a PNG file.
 * @param filename The desired file name for the PNG file.
 * @throws Error - If there is an error converting or writing the PNG file.
 */
export async function writePng(svg: string, filename: string): Promise<void> {
    const pngFilename = changeFileExtension(filename, 'png')
    debug(`About to write png file ${pngFilename}`)

    try {
        const png = renderSvg(svg).asPng()
        await writeFile(pngFilename, png)
        console.log(`Generated png file ${pngFilename}`)
    } catch (err) {
        throw new Error(`Failed to generate PNG file ${pngFilename}`, {
            cause: err,
        })
    }
}

const changeFileExtension = (filename: string, extension: string): string => {
    const parsedFile = path.parse(filename)
    const dir = parsedFile.dir === '' ? '.' : path.resolve(parsedFile.dir)
    return dir + '/' + parsedFile.name + '.' + extension
}
