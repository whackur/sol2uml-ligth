export const networks = <const>[
    'ethereum',
    'sepolia',
    'holesky',
    'hoodi',
    'arbitrum',
    'optimism',
    'polygon',
    'avalanche',
    'base',
    'bsc',
    'crono',
    'fantom',
    'sonic',
    'gnosis',
    'moonbeam',
    'celo',
    'scroll',
    'linea',
    'blast',
    'berachain',
    'zksync',
]

export type Network = (typeof networks)[number]

export const setChainId = (network: string): number =>
    /^-?(0|[1-9]\d*)$/.test(network)
        ? parseInt(network)
        : network === 'sepolia'
          ? 11155111
          : network === 'holesky'
            ? 17000
            : network === 'hoodi'
              ? 560048
              : network === 'arbitrum'
                ? 42161
                : network === 'optimism'
                  ? 10
                  : network === 'polygon'
                    ? 137
                    : network === 'avalanche'
                      ? 43114
                      : network === 'base'
                        ? 8453
                        : network === 'bsc'
                          ? 56
                          : network === 'crono'
                            ? 25
                            : network === 'fantom'
                              ? 250
                              : network === 'sonic'
                                ? 146
                                : network === 'gnosis'
                                  ? 100
                                  : network === 'moonbeam'
                                    ? 1284
                                    : network === 'celo'
                                      ? 42220
                                      : network === 'scroll'
                                        ? 534352
                                        : network === 'linea'
                                          ? 59144
                                          : network === 'blast'
                                            ? 81457
                                            : network === 'berachain'
                                              ? 80094
                                              : network === 'zksync'
                                                ? 324
                                                : 1
