import { parse } from '@solidity-parser/parser'
import type { ASTNode } from '@solidity-parser/parser/dist/src/ast-types'

import { convertAST2UmlClasses } from '../converterAST2Classes.js'
import type { Remapping } from '../imports/remappingTypes.js'
import type { UmlClass } from '../umlClass.js'
import { decodeSourceCodeResponse } from './source-code-response.js'
import { requestSourceCode } from './source-code-client.js'
import type {
    ExplorerSourceCode,
    ExplorerSourceFile,
} from './source-code-types.js'
import { flattenSolidityFiles } from './solidity-code.js'
import { setChainId } from './networks.js'
import type { Network } from './networks.js'
import { ETHERSCAN_API_URL } from './constants.js'

const debug = require('debug')('sol2uml-light')

export { networks, setChainId } from './networks.js'
export type { Network } from './networks.js'

export class EtherscanParser {
    readonly url: string

    constructor(
        protected apiKey?: string,
        public network: Network = 'ethereum',
        url?: string,
    ) {
        if (url) {
            this.url = url
            return
        }

        if (!apiKey) {
            console.error(
                `The -k, --apiKey option or SCAN_API_KEY env var must be set when getting verified source code from an Etherscan like explorer`,
            )
            process.exit(1)
        }

        const chainId = setChainId(network)
        debug(`Chain id ${chainId} for network ${network}`)
        this.url = `${ETHERSCAN_API_URL}?chainid=${chainId}`
    }

    async getUmlClasses(contractAddress: string): Promise<{
        umlClasses: UmlClass[]
        contractName: string
    }> {
        const { files, contractName, remappings } =
            await this.getSourceCode(contractAddress)
        return {
            umlClasses: await this.parseUmlClasses(files, remappings),
            contractName,
        }
    }

    async getSolidityCode(
        contractAddress: string,
        filename?: string,
    ): Promise<{ solidityCode: string; contractName: string }> {
        const { files, contractName, compilerVersion, remappings } =
            await this.getSourceCode(contractAddress, filename)
        const umlClasses = await this.parseUmlClasses(files, remappings)
        return {
            solidityCode: flattenSolidityFiles(
                files,
                umlClasses,
                compilerVersion,
            ),
            contractName,
        }
    }

    async parseSourceCode(sourceCode: string): Promise<ASTNode> {
        try {
            return parse(sourceCode, {})
        } catch (err) {
            throw new Error(
                `Failed to parse solidity code from source code:\n${sourceCode}`,
                { cause: err },
            )
        }
    }

    async getSourceCode(
        contractAddress: string,
        filename?: string,
    ): Promise<ExplorerSourceCode> {
        const description = `get verified source code for address ${contractAddress} from Etherscan API.`

        try {
            const response = await requestSourceCode(
                this.url,
                this.apiKey,
                contractAddress,
            )
            return decodeSourceCodeResponse(
                response.data,
                contractAddress,
                filename,
            )
        } catch (err) {
            if (err.message) {
                throw err
            }
            if (!err.response) {
                // eslint-disable-next-line preserve-caught-error -- Preserve the transport error shape without exposing request details.
                throw new Error(`Failed to ${description}. No HTTP response.`)
            }
            throw new Error(
                `Failed to ${description}. HTTP status code ${err.response?.status}, status text: ${err.response?.statusText}`,
                { cause: err },
            )
        }
    }

    private async parseUmlClasses(
        files: ExplorerSourceFile[],
        remappings: Remapping[],
    ): Promise<UmlClass[]> {
        let umlClasses: UmlClass[] = []
        for (const file of files) {
            debug(`Parsing source file ${file.filename}`)
            const node = await this.parseSourceCode(file.code)
            const parsedClasses = convertAST2UmlClasses(
                node,
                file.filename,
                remappings,
            )
            umlClasses = umlClasses.concat(parsedClasses)
        }
        return umlClasses
    }
}
