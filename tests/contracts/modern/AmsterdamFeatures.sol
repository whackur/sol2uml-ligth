// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

contract AmsterdamFeatures {
    function currentSlotNumber() external view returns (uint256) {
        return block.slotnum;
    }

    function currentSlotNumberAssembly() external view returns (uint256 slotNumber) {
        assembly {
            slotNumber := slotnum()
        }
    }
}
