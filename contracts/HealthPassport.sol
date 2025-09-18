// File: contracts/health/HealthPassport.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAccessManager} from "../interfaces/IAccessManager.sol";
import {IHealthPassport} from "../interfaces/IHealthPassport.sol";

/**
 * @title HealthPassport
 * @notice Stores only pointers (URI) and content hashes of encrypted health data.
 * @dev PHI remains off-chain; on-chain stores verification state + attestations.
 */
contract HealthPassport is IHealthPassport {
    IAccessManager public immutable accessManager;

    struct Passport {
        address owner;
        string dataURI;          // e.g., ipfs://... (encrypted blob)
        bytes32 dataHash;        // keccak256(ciphertext) for integrity
        uint256 createdAt;
        uint256 updatedAt;
        Status status;
        address lastVerifier;
        string verificationURI;  // optional: verifier attestation or report link
    }

    mapping(address => Passport) private _passports;

    event PassportUpserted(address indexed owner, string dataURI, bytes32 dataHash);
    event SubmittedForVerification(address indexed owner);
    event Verified(address indexed owner, address indexed verifier, bool approved, string verificationURI);
    event Revoked(address indexed owner, address indexed admin, string reason);

    error NotOwner();
    error NotVerifier();
    error NotAdmin();

    constructor(IAccessManager manager) {
        accessManager = manager;
    }

    function upsert(string calldata dataURI, bytes32 dataHash) external {
        Passport storage p = _passports[msg.sender];
        if (p.owner == address(0)) {
            p.owner = msg.sender;
            p.createdAt = block.timestamp;
        }
        p.dataURI = dataURI;
        p.dataHash = dataHash;
        p.updatedAt = block.timestamp;

        // Why: Changing data post-verification should trigger re-review.
        if (p.status == Status.Verified) {
            p.status = Status.Pending;
        } else if (p.status == Status.None) {
            p.status = Status.Pending;
        }

        emit PassportUpserted(msg.sender, dataURI, dataHash);
    }

    function submitForVerification() external {
        Passport storage p = _passports[msg.sender];
        if (p.owner == address(0)) {
            // initialize bare record on first submit
            p.owner = msg.sender;
            p.createdAt = block.timestamp;
        }
        p.status = Status.Pending;
        emit SubmittedForVerification(msg.sender);
    }

    function verify(address user, bool approved, string calldata verificationURI) external {
        if (!accessManager.isVerifier(msg.sender)) revert NotVerifier();
        Passport storage p = _passports[user];
        require(p.owner == user && user != address(0), "Passport: no record");
        p.status = approved ? Status.Verified : Status.Rejected;
        p.lastVerifier = msg.sender;
        p.verificationURI = verificationURI;
        p.updatedAt = block.timestamp;
        emit Verified(user, msg.sender, approved, verificationURI);
    }

    function revoke(address user, string calldata reason) external {
        // DEFAULT_ADMIN_ROLE check through AccessManager keeps admin set central
        bytes32 adminRole = accessManager.DEFAULT_ADMIN_ROLE();
        // low-level call to avoid importing AccessControl
        (bool ok, bytes memory data) = address(accessManager).staticcall(
            abi.encodeWithSignature("hasRole(bytes32,address)", adminRole, msg.sender)
        );
        require(ok && abi.decode(data, (bool)), "Not admin");
        Passport storage p = _passports[user];
        require(p.owner == user && user != address(0), "Passport: no record");
        p.status = Status.Revoked;
        p.updatedAt = block.timestamp;
        emit Revoked(user, msg.sender, reason);
    }

    function isVerified(address user) public view override returns (bool) {
        return _passports[user].status == Status.Verified;
    }

    function passportOf(address user) external view override returns (
        address owner,
        string memory dataURI,
        bytes32 dataHash,
        uint256 createdAt,
        uint256 updatedAt,
        Status status,
        address lastVerifier,
        string memory verificationURI
    ) {
        Passport storage p = _passports[user];
        return (p.owner, p.dataURI, p.dataHash, p.createdAt, p.updatedAt, p.status, p.lastVerifier, p.verificationURI);
    }
}