export const parseBlockNumber = (block: string): number => {
    try {
        return parseInt(block)
    } catch {
        throw Error(`Invalid block number: ${block}`)
    }
}
