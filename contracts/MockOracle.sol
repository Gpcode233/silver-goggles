// SPDX-License-Identifier: MIT
// Test oracle that auto-approves all proofs. Required by INFT for transfer
// verification; replace with a real proof verifier before mainnet.
pragma solidity ^0.8.19;

contract MockOracle {
    function verifyProof(bytes calldata) external pure returns (bool) {
        return true;
    }
}
