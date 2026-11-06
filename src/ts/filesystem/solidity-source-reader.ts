import { readFileSync } from 'fs'
import { parse } from '@solidity-parser/parser'
import type { ASTNode } from '@solidity-parser/parser/dist/src/ast-types'

export function parseSolidityFile(fileName: string): ASTNode {
    const solidityCode = readFile(fileName)
    try {
        return parse(solidityCode, {})
    } catch (err) {
        throw new Error(`Failed to parse solidity code in file ${fileName}.`, {
            cause: err,
        })
    }
}

export const readFile = (fileName: string, extension?: string): string => {
    try {
        return readFileSync(fileName, 'utf8')
    } catch (err) {
        if (!extension) {
            throw new Error(`Failed to read file "${fileName}".`, {
                cause: err,
            })
        }

        try {
            return readFileSync(`${fileName}.${extension}`, 'utf8')
        } catch (err) {
            throw new Error(
                `Failed to read file "${fileName}" or "${fileName}.${extension}".`,
                { cause: err },
            )
        }
    }
}
