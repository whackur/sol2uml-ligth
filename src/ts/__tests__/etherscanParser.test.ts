import { parseRemapping, parseRemappings } from '../parserEtherscan.js'
import { setChainId, networks } from '../explorer/networks.js'
import { decodeSourceCodeResponse } from '../explorer/source-code-response.js'
import { renameFile } from '../imports/remappings.js'

describe('Etherscan source response parsing', () => {
    test('decodes a multi-file source with settings remappings', () => {
        const result = decodeSourceCodeResponse(
            {
                result: [
                    {
                        SourceCode: JSON.stringify({
                            settings: { remappings: ['@lib/=lib/'] },
                            sources: {
                                'src/Token.sol': {
                                    content: 'contract Token {}',
                                },
                                'src/Utils.sol': {
                                    content: 'library Utils {}',
                                },
                            },
                        }),
                        ContractName: 'Token',
                        CompilerVersion: 'v0.8.38+commit.1835d247',
                    },
                ],
            },
            '0x123',
        )

        expect(result.files).toEqual([
            { filename: 'src/Token.sol', code: 'contract Token {}' },
            { filename: 'src/Utils.sol', code: 'library Utils {}' },
        ])
        expect(result.contractName).toBe('Token')
        expect(result.compilerVersion).toBe('v0.8.38+commit.1835d247')
        expect(result.remappings).toEqual(parseRemappings(['@lib/=lib/']))
    })

    test('decodes the explorer double-brace source shape', () => {
        const sourceFiles = {
            'src/Token.sol': { content: 'contract Token {}' },
        }
        const responseSource = `{${JSON.stringify({ sources: sourceFiles })}}`
        const result = decodeSourceCodeResponse(
            {
                result: [
                    {
                        SourceCode: responseSource,
                        ContractName: 'Token',
                        CompilerVersion: 'v0.8.38',
                    },
                ],
            },
            '0x123',
        )

        expect(result.files).toEqual([
            { filename: 'src/Token.sol', code: 'contract Token {}' },
        ])
    })

    test('keeps flat-source remappings undefined', () => {
        const result = decodeSourceCodeResponse(
            {
                result: [
                    {
                        SourceCode: 'pragma solidity 0.8.38;',
                        ContractName: 'Token',
                        CompilerVersion: 'v0.8.38',
                    },
                ],
            },
            '0x123',
        )

        expect(result.files).toEqual([
            { filename: '0x123', code: 'pragma solidity 0.8.38;' },
        ])
        expect(result.remappings).toBeUndefined()
    })

    test('filters multi-file source by basename', () => {
        const result = decodeSourceCodeResponse(
            {
                result: [
                    {
                        SourceCode: JSON.stringify({
                            sources: {
                                'first/Token.sol': {
                                    content: 'contract First {}',
                                },
                                'second/Token.sol': {
                                    content: 'contract Second {}',
                                },
                                'second/Other.sol': {
                                    content: 'contract Other {}',
                                },
                            },
                        }),
                        ContractName: 'Token',
                        CompilerVersion: 'v0.8.38',
                    },
                ],
            },
            '0x123',
            'Token',
        )

        expect(result.files).toEqual([
            { filename: 'first/Token.sol', code: 'contract First {}' },
            { filename: 'second/Token.sol', code: 'contract Second {}' },
        ])
    })

    test('reports absent source results and malformed source JSON', () => {
        expect(() => decodeSourceCodeResponse({}, '0x123')).toThrow(
            /No result array in HTTP data/,
        )
        expect(() =>
            decodeSourceCodeResponse(
                {
                    result: [
                        {
                            SourceCode: '{not json',
                            ContractName: 'Token',
                            CompilerVersion: 'v0.8.38',
                        },
                    ],
                },
                '0x123',
            ),
        ).toThrow(/Failed to parse Solidity source code/)
    })
})

describe('Explorer networks', () => {
    test('retains network order and defaults unknown names to Ethereum', () => {
        expect(networks[0]).toBe('ethereum')
        expect(networks[networks.length - 1]).toBe('zksync')
        expect(setChainId('unknown-network')).toBe(1)
        expect(setChainId('10')).toBe(10)
    })
})

describe('remapping filename', () => {
    test.each`
        fileName                                                                      | mapping                                         | expected
        ${'@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol'}                 | ${'@openzeppelin/=lib/openzeppelin-contracts/'} | ${'lib/openzeppelin-contracts/contracts/token/ERC721/IERC721Receiver.sol'}
        ${'@openzeppelin/IERC20.sol'}                                                 | ${'@openzeppelin/=lib/openzeppelin-contracts/'} | ${'lib/openzeppelin-contracts/IERC20.sol'}
        ${'@openzeppelin/lib/openzeppelin-contracts/IERC20.sol'}                      | ${'@openzeppelin/=lib/openzeppelin-contracts/'} | ${'lib/openzeppelin-contracts/lib/openzeppelin-contracts/IERC20.sol'}
        ${'node_modules/@openzeppelin/contracts-upgradeable/proxy/Initializable.sol'} | ${'node_modules/='}                             | ${'@openzeppelin/contracts-upgradeable/proxy/Initializable.sol'}
        ${'Interface.sol'}                                                            | ${'face=xxx'}                                   | ${'Interface.sol'}
        ${'./contracts/Interface.sol'}                                                | ${'node_modules/='}                             | ${'./contracts/Interface.sol'}
        ${'Interface.sol'}                                                            | ${'I=III'}                                      | ${'IIInterface.sol'}
        ${'Interface.sol'}                                                            | ${'i=xxx'}                                      | ${'Interface.sol'}
    `('$mapping ', ({ fileName, mapping, expected }) => {
        const remapping = parseRemapping(mapping)
        expect(renameFile(fileName, [remapping])).toEqual(expected)
    })
})
