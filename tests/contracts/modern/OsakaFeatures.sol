// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

contract OsakaFeatures {
    function writeTransient(uint256 value) external {
        assembly {
            tstore(0, value)
        }
    }

    function readTransient() external view returns (uint256 value) {
        assembly {
            value := tload(0)
        }
    }

    function copyBytes(bytes calldata input) external pure returns (bytes memory copied) {
        bytes memory source = input;
        copied = new bytes(source.length);
        assembly {
            mcopy(add(copied, 0x20), add(source, 0x20), mload(source))
        }
    }

    function blobParameters()
        external
        view
        returns (bytes32 firstBlobHash, uint256 currentBlobBaseFee)
    {
        firstBlobHash = blobhash(0);
        currentBlobBaseFee = block.blobbasefee;
    }
}
