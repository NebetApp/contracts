// File: contracts/access/AccessManager.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title AccessManager
 * @notice Central RBAC + Verifier registry for the Health dApp.
 * @dev Keep a single contract to gate verification across modules.
 */
contract AccessManager is AccessControl {
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant PAUSER_ROLE   = keccak256("PAUSER_ROLE");

    struct Verifier {
        bool active;
        string name;
        string uri; // public info, e.g., website/license reference
    }

    mapping(address => Verifier) private _verifiers;

    event VerifierAdded(address indexed account, string name, string uri);
    event VerifierRemoved(address indexed account);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function addVerifier(address account, string calldata name, string calldata uri) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(VERIFIER_ROLE, account);
        _verifiers[account] = Verifier({active: true, name: name, uri: uri});
        emit VerifierAdded(account, name, uri);
    }

    function removeVerifier(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(VERIFIER_ROLE, account);
        delete _verifiers[account];
        emit VerifierRemoved(account);
    }

    function isVerifier(address account) external view returns (bool) {
        return hasRole(VERIFIER_ROLE, account);
    }

    function verifierInfo(address account) external view returns (Verifier memory) {
        return _verifiers[account];
    }
}