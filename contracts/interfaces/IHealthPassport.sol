// File: contracts/interfaces/IHealthPassport.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IZKPVerifier} from "./IZKPVerifier.sol";

interface IHealthPassport {
    enum Status { None, Pending, Verified, Rejected, Revoked }

    // Encrypted user data structure (only visible to NFT owner)
    struct UserData {
        string encryptedName;        // Encrypted full name
        string encryptedBirthDate;   // Encrypted birth date
        string encryptedNationality; // Encrypted nationality
        string encryptedVaccines;    // Encrypted vaccination history
        string encryptedMedications; // Encrypted current medications
        string encryptedAllergies;   // Encrypted allergies
        string encryptedTreatments;  // Encrypted treatment history
    }

    // NFT functions
    function mintPassport(
        string calldata dataURI,
        bytes32 dataHash,
        UserData calldata userData,
        IZKPVerifier.Proof[] calldata demographicProofs,
        IZKPVerifier.DemographicCategory[] calldata categories,
        uint256[] calldata values
    ) external payable returns (uint256 tokenId);

    function tokenURI(uint256 tokenId) external view returns (string memory);

    // Data access (only for NFT owner)
    function getUserData(uint256 tokenId) external view returns (UserData memory);
    function getProofRecords(uint256 tokenId)
        external
        view
        returns (
            uint256[] memory proofIds,
            IZKPVerifier.DemographicCategory[] memory categories,
            uint256[] memory values,
            bool[] memory verified
        );

    // Verification functions
    function submitForVerification(uint256 tokenId) external;
    function verify(uint256 tokenId, bool approved, string calldata verificationURI) external;
    function revoke(uint256 tokenId, string calldata reason) external;

    // View functions
    function isVerified(uint256 tokenId) external view returns (bool);
    function passportOf(uint256 tokenId) external view returns (
        address owner,
        string memory dataURI,
        bytes32 dataHash,
        uint256 createdAt,
        uint256 updatedAt,
        Status status,
        address lastVerifier,
        string memory verificationURI
    );

    // Analytics (anonymized data for platform analytics)
    function getAnalyticsData() external view returns (
        uint256 totalPassports,
        uint256 verifiedPassports
    );
}
