// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockVerifier {
    function verify(
        bytes calldata proof,
        uint256[] calldata pubInputs
    ) external pure returns (bool) {
        // Mock verifier - always returns true for testing
        return proof.length > 0 && pubInputs.length == 6;
    }
}