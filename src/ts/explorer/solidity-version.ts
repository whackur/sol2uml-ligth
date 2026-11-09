export const parseSolidityVersion = (compilerVersion: string): string => {
    // A non-matching version throws a TypeError on result[1]; kept as-is
    const result = compilerVersion.match(
        `v(\\d+.\\d+.\\d+)`,
    ) as RegExpMatchArray
    if (result[1]) {
        return result[1]
    }
    throw Error(`Failed to parse compiler version ${compilerVersion}`)
}
