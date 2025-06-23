// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title Interface for a zk-SNARK verifier contract (Groth16)
interface IVerifier {
    /// @notice Verifies a proof given its public inputs
    /// @param proof   The serialized proof bytes
    /// @param pubIns  The public-inputs array
    /// @return ok     True iff the proof is valid
    function verify(
        bytes calldata proof,
        uint256[] calldata pubIns
    ) external view returns (bool ok);
}
