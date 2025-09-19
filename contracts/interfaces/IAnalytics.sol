// File: contracts/interfaces/IAnalytics.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAnalytics {
    function updatePassportMetrics(uint256 totalPassports, uint256 verifiedPassports, uint256 revenue) external;
    function recordVerifiedDemographic(uint8 category, uint256 value, uint256 amount) external;
    function getGlobalMetrics() external view returns (uint256, uint256, uint256, uint256);
    function getVerifiedDemographicCount(uint8 category, uint256 value) external view returns (uint256);
    function getVerifiedDemographicBatch(uint8[] calldata categories, uint256[] calldata values) external view returns (uint256[] memory);
}
