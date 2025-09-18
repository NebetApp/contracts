// File: contracts/interfaces/IHealthPassport.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IHealthPassport {
    enum Status { None, Pending, Verified, Rejected, Revoked }
    function isVerified(address user) external view returns (bool);
    function passportOf(address user) external view returns (
        address owner,
        string memory dataURI,
        bytes32 dataHash,
        uint256 createdAt,
        uint256 updatedAt,
        Status status,
        address lastVerifier,
        string memory verificationURI
    );
}