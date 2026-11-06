import { statSync } from 'fs'

export const isFile = (fileName: string): boolean => {
    try {
        return statSync(fileName).isFile()
    } catch {
        return false
    }
}

export const isFolder = (fileName: string): boolean => {
    try {
        return statSync(fileName).isDirectory()
    } catch {
        return false
    }
}
