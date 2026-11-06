# Examples

## Current, reproducible diagrams

The examples in this section are generated offline from the checked-in source tree and the installed stable dependencies. Rebuild them with `pnpm run examples:build`. The generator uses the built CLI, writes through its output writer, checks installed dependency versions, and fails if an expected SVG or contract is missing.

### OpenZeppelin Contracts 5.6.1

The current OpenZeppelin diagrams use [Contracts 5.6.1](https://github.com/OpenZeppelin/openzeppelin-contracts/tree/v5.6.1/contracts), the stable release pinned for this repository.

![OpenZeppelin ERC20](./OpenZeppelinERC20.svg)

The broader package diagram is [OpenZeppelinAll.svg](./OpenZeppelinAll.svg). The current gallery also includes focused [ERC721](./current/OpenZeppelinERC721.svg) and [AccessControl](./current/OpenZeppelinAccessControl.svg) diagrams.

### Local token, NFT, and vault fixtures

These diagrams are generated from [`tests/contracts/current`](../tests/contracts/current) and the installed OpenZeppelin 5.6.1 dependency. Class diagrams show imported inheritance; storage diagrams show layout derived from the local Solidity source.

| Fixture                       | Class diagram                                             | Storage diagram                                                    |
| ----------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------ |
| ExampleToken (ERC20, Ownable) | ![ExampleToken class diagram](./current/ExampleToken.svg) | ![ExampleToken storage diagram](./current/ExampleTokenStorage.svg) |
| ExampleNft (ERC721, Ownable)  | ![ExampleNft class diagram](./current/ExampleNft.svg)     | ![ExampleNft storage diagram](./current/ExampleNftStorage.svg)     |
| ExampleVault (ERC-4626)       | ![ExampleVault class diagram](./current/ExampleVault.svg) | ![ExampleVault storage diagram](./current/ExampleVaultStorage.svg) |

### Current Solidity language examples

The compiler compatibility fixtures also have generated diagrams for language features introduced in Osaka and experimental Amsterdam:

| Fixture   | Diagram                                                         |
| --------- | --------------------------------------------------------------- |
| Osaka     | ![Osaka language features](./current/OsakaFeatures.svg)         |
| Amsterdam | ![Amsterdam language features](./current/AmsterdamFeatures.svg) |

### Account Abstraction 0.8.0

The [Account Abstraction gallery](./accountAbstraction/README.md) uses the stable [`@account-abstraction/contracts` 0.8.0 package](https://github.com/eth-infinitism/account-abstraction/tree/v0.8.0). Its diagrams include the package's current contracts and their installed OpenZeppelin dependencies.

### Local storage layouts

These diagrams are regenerated from the checked-in contracts using Solidity 0.8.38:

| Source                           | Diagram                                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `BasicStorage`                   | ![BasicStorage layout](./storage/BasicStorage.svg)                                                     |
| `DynamicArrayStorage`            | ![DynamicArrayStorage layout](./storage/DynamicArrayStorage.svg)                                       |
| `FixedArrayStorage`              | ![FixedArrayStorage layout](./storage/FixedArrayStorage.svg)                                           |
| `MappingStorage`                 | ![MappingStorage layout](./storage/MappingStorage.svg)                                                 |
| `MultiDynamicArrayStorage`       | ![MultiDynamicArrayStorage layout](./storage/MultiDynamicArrayStorage.svg)                             |
| `MultiFixedArrayStorage`         | ![MultiFixedArrayStorage layout](./storage/MultiFixedArrayStorage.svg)                                 |
| `StringStorage`                  | ![StringStorage layout](./storage/StringStorage.svg)                                                   |
| `StructStorage`                  | ![StructStorage layout](./storage/StructStorage.svg)                                                   |
| `TestStorage`                    | ![TestStorage layout](./storage/TestStorage.svg)                                                       |
| `TestContract` file-level layout | ![File-level storage layout](./storage/FileLevel-storage.svg) ([PNG](./storage/FileLevel-storage.png)) |
| Inheritance contract `D`         | ![Inheritance layout](./storage/inheritanceStorage.svg)                                                |

See [storage diagram explanations](./storage/README.md) for the layout rules and archived on-chain examples.

## Archived explorer snapshots

The diagrams below were generated from verified contract source retrieved from explorers in an earlier project snapshot. They are retained as historical examples; their source addresses identify the inputs used at that time and do not imply current verification status or live RPC validation. They are not rebuilt by `pnpm run examples:build`.

| Diagram                                                                                     | Original source                                                                                                                |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| ![Bored Ape Yacht Club](./BoredApeYachtClub.svg)                                            | Ethereum, [BAYC `0xbc4ca0…36f13d`](https://etherscan.io/address/0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d#code)               |
| ![mStable mUSD](./polygonMusd.svg)                                                          | Polygon, [mUSD `0xca9cf4…86e0b`](https://polygonscan.com/address/0xca9cf48ad534f1efa2b0f6923457f2953df86e0b#code)              |
| ![Crypto Blades](./bscCryptoBlades.svg)                                                     | BNB Smart Chain, [Crypto Blades `0xb07c1c…86d65`](https://bscscan.com/address/0xb07c1c479b2fdeb9f9b2d02300c13b328bf86d65#code) |
| ![Uniswap V3 Router](./uniswap-router.svg)                                                  | Ethereum, [Uniswap V3 Router `0x68b346…65fc45`](https://etherscan.io/address/0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45#code)  |
| ![Uniswap V3 Router, squashed](./uniswap-router-squash.svg)                                 | Same Ethereum source address as above                                                                                          |
| ![Uniswap V3 Router, squashed without source labels](./uniswap-router-squash-no-source.svg) | Same Ethereum source address as above                                                                                          |
| ![Tether](./tether.svg)                                                                     | Ethereum, [Tether `0xdac17f…31ec7`](https://etherscan.io/address/0xdac17f958d2ee523a2206206994597c13d831ec7#code)              |
| ![Compound cDAI](./CErc20.svg)                                                              | Ethereum, [Compound cDAI `0xf5dce5…c444dc`](https://etherscan.io/address/0xf5dce57282a584d2746faf1593d3121fcac444dc#code)      |
| ![Compound cDAI, filtered](./CErc20-hide.svg)                                               | Same Ethereum source address as above                                                                                          |

Other diagrams imported with the project are retained as legacy artifacts and are not presented as current examples. Where the import did not preserve the original address, this page does not infer one from a filename.
