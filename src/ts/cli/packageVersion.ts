import { basename, dirname, resolve } from 'path'

export const getPackageVersion = (): string => {
    const packagePath =
        basename(dirname(__dirname)) === 'ts'
            ? '../../../package.json'
            : '../../package.json'
    const packageDetails: { version: string } = require(
        resolve(__dirname, packagePath),
    )
    return packageDetails.version
}
