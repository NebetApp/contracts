// File: contracts/funding/TreatmentCampaign.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ITreatmentCampaign} from "./interfaces/ITreatmentCampaign.sol";

/**
 * @title TreatmentCampaign (minimal-proxy friendly)
 * @notice One instance per treatment; funds held here; ERC20-based.
 * @dev Initialized by FundingHub clones; pull-payments for refunds/withdrawals.
 */
contract TreatmentCampaign is ITreatmentCampaign, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    address public hub;
    address public override token;
    address public override beneficiary;
    address public override payout;

    uint256 public override goal;
    uint64  public override deadline;

    State private _state;
    uint256 public override totalPledged;
    bool private _initialized;

    mapping(address => uint256) public pledges;

    event Pledged(address indexed donor, uint256 amount);
    event Unpledged(address indexed donor, uint256 amount);
    event Finalized(State state);
    event Withdrawn(address indexed beneficiary, address indexed to, uint256 amount);
    event Refunded(address indexed donor, uint256 amount);
    event Canceled(address indexed by);

    modifier onlyHub() {
        require(msg.sender == hub, "Only hub");
        _;
    }

    function state() external view override returns (State) {
        return _state;
    }

    function initialize(
        address _hub,
        address _token,
        address _beneficiary,
        address _payout,
        uint256 _goal,
        uint64  _deadline
    ) external override {
        require(!_initialized, "Initialized");
        require(_hub != address(0) && _token != address(0) && _beneficiary != address(0), "Zero addr");
        require(_goal > 0, "Goal=0");
        // Why: avoid dead campaigns.
        require(_deadline > block.timestamp, "Past deadline");

        hub = _hub;
        token = _token;
        beneficiary = _beneficiary;
        payout = _payout == address(0) ? _beneficiary : _payout;
        goal = _goal;
        deadline = _deadline;
        _state = State.Active;
        _initialized = true;
    }

    function pledge(uint256 amount) external nonReentrant whenNotPaused {
        require(_state == State.Active, "Not Active");
        require(block.timestamp < deadline, "After deadline");
        require(amount > 0, "Zero amount");
        pledges[msg.sender] += amount;
        totalPledged += amount;
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit Pledged(msg.sender, amount);
    }

    function unpledge(uint256 amount) external nonReentrant whenNotPaused {
        require(_state == State.Active, "Not Active");
        require(block.timestamp < deadline, "After deadline");
        uint256 bal = pledges[msg.sender];
        require(amount > 0 && amount <= bal, "Invalid amount");
        pledges[msg.sender] = bal - amount;
        totalPledged -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);
        emit Unpledged(msg.sender, amount);
    }

    function finalize() public whenNotPaused {
        require(_state == State.Active, "Finalized");
        // early success if goal reached
        if (totalPledged >= goal) {
            _state = State.Successful;
        } else if (block.timestamp >= deadline) {
            _state = totalPledged >= goal ? State.Successful : State.Failed;
        } else {
            revert("Too early");
        }
        emit Finalized(_state);
    }

    function withdraw() external nonReentrant whenNotPaused {
        if (_state == State.Active) finalize();
        require(_state == State.Successful, "Not successful");
        require(msg.sender == beneficiary, "Not beneficiary");
        _state = State.Withdrawn;
        uint256 amt = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransfer(payout, amt);
        emit Withdrawn(msg.sender, payout, amt);
    }

    function claimRefund() external nonReentrant whenNotPaused {
        if (_state == State.Active) finalize();
        require(_state == State.Failed || _state == State.Canceled, "No refunds");
        uint256 amt = pledges[msg.sender];
        require(amt > 0, "Nothing to refund");
        pledges[msg.sender] = 0;
        IERC20(token).safeTransfer(msg.sender, amt);
        emit Refunded(msg.sender, amt);
    }

    function cancel() external onlyHub whenNotPaused {
        require(_state == State.Active, "Not active");
        _state = State.Canceled;
        emit Canceled(msg.sender);
    }

    function pause() external onlyHub { _pause(); }
    function unpause() external onlyHub { _unpause(); }
}