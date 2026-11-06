import { diffCode } from '../utils/diff.js'
import { compareVerifiedSourceFiles } from '../diff/source-comparison.js'

const captureDiff = (codeA: string, codeB: string): string => {
    const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {})
    diffCode(codeA, codeB, 2)
    const output = consoleLog.mock.calls[0][0] as string
    consoleLog.mockRestore()
    return output.replace(/\u001b\[[0-9;]*m/g, '')
}

describe('Code diff output', () => {
    test('prints line numbers for unchanged text', () => {
        expect(
            captureDiff('a simple line of text', 'a simple line of text'),
        ).toBe('1 a simple line of text\n')
    })

    test('shows changed content on both sides', () => {
        const output = captureDiff(
            'a simple line of text',
            'a simple line of normal text',
        )

        expect(output).toContain('a simple line of normal text')
    })

    test('omits long equal blocks between changes', () => {
        const codeA =
            'line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nline 8\nline 9'
        const codeB =
            'line one\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nadded two\nnew lines'
        const output = captureDiff(codeA, codeB)

        expect(output).toContain('---')
        expect(output).toContain('line 2')
        expect(output).toContain('added two')
    })
})

describe('Verified source comparison', () => {
    test.each([
        [
            'same named single file',
            'contract Same {}',
            'contract Same {}',
            'match',
        ],
        [
            'changed named single file',
            'contract Before {}',
            'contract After {}',
            'changed',
        ],
    ])('%s is compared by its filename', (_name, aCode, bCode, result) => {
        expect(
            compareVerifiedSourceFiles(
                [{ filename: 'src/Contract.sol', code: aCode }],
                [{ filename: 'src/Contract.sol', code: bCode }],
            ),
        ).toEqual([
            {
                filename: 'src/Contract.sol',
                aCode,
                bCode,
                result,
            },
        ])
    })

    test('reports renamed named single files as a removal and an addition', () => {
        expect(
            compareVerifiedSourceFiles(
                [{ filename: 'src/Old.sol', code: 'contract Old {}' }],
                [{ filename: 'src/New.sol', code: 'contract New {}' }],
            ),
        ).toEqual([
            {
                filename: 'src/New.sol',
                bCode: 'contract New {}',
                result: 'added',
            },
            {
                filename: 'src/Old.sol',
                aCode: 'contract Old {}',
                result: 'removed',
            },
        ])
    })

    test('keeps flat address files compared as a single source', () => {
        const addressA = `0x${'a'.repeat(40)}`
        const addressB = `0x${'b'.repeat(40)}`

        expect(
            compareVerifiedSourceFiles(
                [{ filename: addressA, code: 'contract Before {}' }],
                [{ filename: addressB, code: 'contract After {}' }],
            ),
        ).toEqual([
            {
                filename: `${addressA} to ${addressB}`,
                aCode: 'contract Before {}',
                bCode: 'contract After {}',
                result: 'changed',
            },
        ])
    })

    test('reports additions, removals, and changed files in filename order', () => {
        const diffs = compareVerifiedSourceFiles(
            [
                { filename: 'z/Changed.sol', code: 'contract Old {}' },
                { filename: 'a/Removed.sol', code: 'contract Removed {}' },
            ],
            [
                { filename: 'z/Changed.sol', code: 'contract New {}' },
                { filename: 'b/Added.sol', code: 'contract Added {}' },
            ],
        )

        expect(diffs).toEqual([
            {
                filename: 'a/Removed.sol',
                aCode: 'contract Removed {}',
                result: 'removed',
            },
            {
                filename: 'b/Added.sol',
                bCode: 'contract Added {}',
                result: 'added',
            },
            {
                filename: 'z/Changed.sol',
                aCode: 'contract Old {}',
                bCode: 'contract New {}',
                result: 'changed',
            },
        ])
    })
})
