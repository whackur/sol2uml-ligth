// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract ExampleToken is ERC20, Ownable {
    constructor(address initialOwner)
        ERC20("Example Token", "EXT")
        Ownable(initialOwner)
    {}

    function mint(address account, uint256 amount) external onlyOwner {
        _mint(account, amount);
    }
}
