pragma solidity 0.8.38;

contract Base {
    struct S {
        uint256 x;
    }
}

contract InheritedShadow is Base {
    S internal s;
    uint256 internal afterS;
}

struct S {
    uint256 x;
    uint256 y;
}
