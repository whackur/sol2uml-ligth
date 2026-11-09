export const parseSolidityVersion = (compilerVersion: string): string => {
    const result = compilerVersion.match(`v(\\d+.\\d+.\\d+)`)
    if (result?.[1]) {
        return result[1]
    }
    throw Error(`Failed to parse compiler version ${compilerVersion}`)
}
