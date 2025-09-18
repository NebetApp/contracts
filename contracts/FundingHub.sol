// File: contracts/funding/FundingHub.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAccessManager} from "../interfaces/IAccessManager.sol";
import {IHealthPassport} from "../interfaces/IHealthPassport.sol";
import {ITreatmentCampaign} from "./ITreatmentCampaign.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

/**
 * @title FundingHub
 * @notice Factory + controller for TreatmentCampaign clones.
 * @dev Verifies patient status via HealthPassport before creation.
 */
contract FundingHub {
    using Clones for address;

    IAccessManager public immutable accessManager;
    IHealthPassport public immutable passport;
    address public immutable campaignImplementation;
    address public admin;

    event CampaignCreated(address indexed campaign, address indexed beneficiary, address token, uint256 goal, uint64 deadline, address payout);
    event CampaignCanceled(address indexed campaign);
    event Paused(address indexed campaign);
    event Unpaused(address indexed campaign);
    event AdminChanged(address indexed newAdmin);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    constructor(IAccessManager _access, IHealthPassport _passport, address _campaignImplementation, address _admin) {
        require(address(_access) != address(0) && address(_passport) != address(0) && _campaignImplementation != address(0), "Zero addr");
        accessManager = _access;
        passport = _passport;
        campaignImplementation = _campaignImplementation;
        admin = _admin;
    }

    function setAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Zero addr");
        admin = newAdmin;
        emit AdminChanged(newAdmin);
    }

    function createCampaign(
        address beneficiary,
        address token,
        uint256 goal,
        uint64  deadline,
        address payout
    ) external returns (address campaign) {
        require(passport.isVerified(beneficiary), "Beneficiary not verified");
        campaign = campaignImplementation.clone();
        ITreatmentCampaign(campaign).initialize(address(this), token, beneficiary, payout, goal, deadline);
        emit CampaignCreated(campaign, beneficiary, token, goal, deadline, payout);
    }

    function cancelCampaign(address campaign) external onlyAdmin {
        ITreatmentCampaign(campaign); // basic interface check
        // low-level call to avoid importing the full ABI
        (bool ok, ) = campaign.call(abi.encodeWithSignature("cancel()"));
        require(ok, "Cancel failed");
        emit CampaignCanceled(campaign);
    }

    function pauseCampaign(address campaign) external onlyAdmin {
        (bool ok, ) = campaign.call(abi.encodeWithSignature("pause()"));
        require(ok, "Pause failed");
        emit Paused(campaign);
    }

    function unpauseCampaign(address campaign) external onlyAdmin {
        (bool ok, ) = campaign.call(abi.encodeWithSignature("unpause()"));
        require(ok, "Unpause failed");
        emit Unpaused(campaign);
    }
}