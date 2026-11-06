// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {Base, BaseAliased as Base2} from './BaseImport.sol';

contract Concrete is Base, Base2 {
    uint256 public concreteNum;
}
