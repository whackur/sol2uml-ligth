pragma solidity 0.8.38;

import {S} from './S.sol';

contract Base {
    struct S {
        uint256 x;
    }
}

contract ImportedShadow is Base {
    S internal s;
    uint256 internal afterS;
}
