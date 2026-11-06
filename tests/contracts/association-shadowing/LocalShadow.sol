pragma solidity 0.8.38;

contract LocalShadow {
    struct S {
        uint256 x;
    }

    S internal s;
    uint256 internal afterS;
}

struct S {
    uint256 x;
    uint256 y;
}
