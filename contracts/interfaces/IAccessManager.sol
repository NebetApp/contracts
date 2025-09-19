// File: contracts/interfaces/IAccessManager.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAccessManager {
    function DEFAULT_ADMIN_ROLE() external view returns (bytes32);
    function VERIFIER_ROLE() external view returns (bytes32);
    function isVerifier(address account) external view returns (bool);
}