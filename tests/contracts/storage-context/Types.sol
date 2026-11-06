pragma solidity 0.8.38;

struct FileData {
    uint256 amount;
}

library L {
    uint256 internal constant N = 2;

    enum E {
        A,
        B
    }

    struct Leaf {
        uint128 a;
        uint128 b;
    }

    struct Inner {
        Leaf leaf;
        E kind;
        uint8 n;
    }

    struct Outer {
        Inner inner;
        FileData data;
        Leaf[2] fixedLeaves;
        mapping(address => Inner) records;
        Leaf[] dynamicLeaves;
    }

    struct Dimensioned {
        uint256[N] items;
    }
}
