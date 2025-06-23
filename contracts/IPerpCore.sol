// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IPerpCore {
    function applyNetDelta(uint8 assetId, int256 qty, int256 marginDelta) external;
}
