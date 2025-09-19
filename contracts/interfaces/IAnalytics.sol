// File: contracts/interfaces/IAnalytics.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAnalytics {
    function updatePassportMetrics(uint256 totalPassports, uint256 verifiedPassports, uint256 revenue) external;
    function updateDemographicData(
        uint256 birthYear,
        bytes32 nationalityHash,
        bytes32 vaccineHash,
        bytes32 medicationHash,
        bytes32 allergyHash,
        bytes32 treatmentHash
    ) external;
    function getGlobalMetrics() external view returns (
        uint256 totalPassports,
        uint256 verifiedPassports,
        uint256 totalRevenue,
        uint256 lastUpdated
    );
}