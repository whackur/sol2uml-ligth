export interface DiffOptions {
    network: string
    bNetwork?: string
    lineBuffer: number
    summary?: boolean
    aFile?: string
    bFile?: string
    saveFiles?: boolean
}

export interface DiffFiles {
    filename?: string
    aCode?: string
    bCode?: string
    result: 'added' | 'removed' | 'match' | 'changed'
}

export interface CompareContracts {
    files: DiffFiles[]
    contractNameA: string
    contractNameB?: string
    local?: 'file' | 'folders'
}
