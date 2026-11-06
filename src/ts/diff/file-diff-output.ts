import type { DiffFiles } from './types.js'
import { diffCode } from './code-diff-output.js'

const clc = require('cli-color')

export const displayFileDiffSummary = (fileDiffs: DiffFiles[]): void => {
    for (const file of fileDiffs) {
        switch (file.result) {
            case 'match':
                console.log(`${file.result.padEnd(7)} ${file.filename}`)
                break
            case 'added':
                console.log(
                    `${clc.green(file.result.padEnd(7))} ${file.filename}`,
                )
                break
            case 'changed':
            case 'removed':
                console.log(`${clc.red(file.result)} ${file.filename}`)
                break
        }
    }
}

export const displayFileDiffs = (
    fileDiffs: DiffFiles[],
    options: { lineBuffer?: number; aFile?: string } = {},
): void => {
    let aFileFound = false
    for (const file of fileDiffs) {
        if (options.aFile) {
            if (file.filename !== options.aFile) continue
            else aFileFound = true
        }
        switch (file.result) {
            case 'added':
                console.log(`Added ${file.filename}`)
                console.log(clc.green(file.bCode))
                break
            case 'changed':
                console.log(`Changed ${file.filename}`)
                diffCode(file.aCode, file.bCode, options.lineBuffer)
                break
            case 'removed':
                console.log(`Removed ${file.filename}`)
                console.log(clc.red(file.aCode))
                break
        }
    }
    if (options.aFile && !aFileFound) {
        throw new Error(
            `Could not display code diff for file "${options.aFile}".\nMake sure the full file path and extension is used as displayed in the file summary.`,
        )
    }
}
