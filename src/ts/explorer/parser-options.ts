import type { Network } from './networks.js'

export interface ParserOptions {
    apiKey?: string
    network?: Network
    explorerUrl?: string
    subfolders?: string
    ignoreFilesOrFolders?: string[]
}
