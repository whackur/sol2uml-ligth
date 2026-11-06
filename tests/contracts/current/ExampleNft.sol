// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract ExampleNft is ERC721, Ownable {
    constructor(address initialOwner)
        ERC721("Example NFT", "ENFT")
        Ownable(initialOwner)
    {}

    function mint(address account, uint256 tokenId) external onlyOwner {
        _safeMint(account, tokenId);
    }
}
