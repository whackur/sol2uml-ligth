import { formatCodeDiff } from './code-diff-format.js'

export const diffCode = (
    codeA: string,
    codeB: string,
    lineBuffer: number,
): void => {
    console.log(formatCodeDiff(codeA, codeB, lineBuffer))
}
