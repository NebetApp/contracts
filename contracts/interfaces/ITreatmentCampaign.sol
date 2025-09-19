// File: contracts/funding/ITreatmentCampaign.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITreatmentCampaign {
    enum State { Active, Successful, Failed, Canceled, Withdrawn }
    function initialize(
        address hub,
        address token,
        address beneficiary,
        address payout,
        uint256 goal,
        uint64  deadline
    ) external;

    function state() external view returns (State);
    function token() external view returns (address);
    function beneficiary() external view returns (address);
    function payout() external view returns (address);
    function goal() external view returns (uint256);
    function deadline() external view returns (uint64);
    function totalPledged() external view returns (uint256);
}