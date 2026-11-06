import type { Remapping } from '../imports/remappingTypes.js'

export interface ExplorerSourceFile {
    code: string
    filename: string
}

export interface ExplorerSourceCode {
    files: ExplorerSourceFile[]
    contractName: string
    compilerVersion: string
    remappings: Remapping[]
}

export interface ExplorerSourceCodeObject {
    sources?: Record<
        string,
        { content: string } | [string, { content: string }]
    >
    settings?: { remappings?: string[] }
    [key: string]: unknown
}

export interface ExplorerContractResult {
    SourceCode: string | ExplorerSourceCodeObject
    ContractName: string
    CompilerVersion: string
}

export interface ExplorerResponseData {
    result?: unknown
}
