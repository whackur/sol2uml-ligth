pragma solidity 0.8.38;

import {L as Alias} from "./Types.sol";

contract LocalConstantUse {
    uint256 constant N = 2;

    struct S {
        uint256[N] items;
    }

    S value;
    uint256 tail;
}

contract Use {
    uint256 constant N = 3;

    uint8 head;
    Alias.Outer outer;
    Alias.Leaf[2] leaves;
    mapping(address => Alias.Inner) records;
    uint8 tail;
    Alias.Dimensioned dimensioned;
    uint256 dimensionTail;
}
