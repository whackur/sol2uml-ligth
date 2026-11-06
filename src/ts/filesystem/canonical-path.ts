import { realpathSync } from 'fs'

export const canonicalPath = (filePath: string): string =>
    process.platform === 'win32'
        ? realpathSync.native(filePath)
        : realpathSync(filePath)
