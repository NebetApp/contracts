// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAccessManager} from "./interfaces/IAccessManager.sol";
import {IHealthPassport} from "./interfaces/IHealthPassport.sol";
import {IAnalytics} from "./interfaces/IAnalytics.sol";
import {IZKPVerifier} from "./interfaces/IZKPVerifier.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title HealthPassport
 * @notice NFT-based health passport storing encrypted PHI off-chain with on-chain verification
 * @dev ERC721 NFT where token ownership grants access to encrypted health data
 */
contract HealthPassport is IHealthPassport, ERC721, ERC721URIStorage {
    using SafeERC20 for IERC20;

    IAccessManager public immutable accessManager;
    IERC20 public immutable usdtToken;
    IAnalytics public immutable analytics;
    IZKPVerifier public immutable zkpVerifier;
    uint256 public constant PASSPORT_FEE = 50 * 10**6; // 50 USDT (assuming 6 decimals)

    struct Passport {
        string dataURI;          // e.g., ipfs://... (encrypted blob)
        bytes32 dataHash;        // keccak256(ciphertext) for integrity
        uint256 createdAt;
        uint256 updatedAt;
        Status status;
        address lastVerifier;
        string verificationURI;  // optional: verifier attestation or report link
        UserData userData;       // Encrypted user information
    }

    struct StoredProof {
        uint256 proofId;
        IZKPVerifier.DemographicCategory category;
        uint256 value;
    }

    // Analytics tracking (anonymized)
    struct AnalyticsData {
        uint256 totalPassports;
        uint256 verifiedPassports;
        mapping(uint256 => uint256) birthYearDistribution; // birthYear => count
    }

    enum VerificationMethod { Manual, Oracle, ZKP }

    struct VerificationRequest {
        uint256 tokenId;
        VerificationMethod method;
        uint256 requestTime;
        bool fulfilled;
        bytes proof; // For ZKP or oracle responses
    }

    mapping(uint256 => Passport) private _passports;
    AnalyticsData private _analytics;
    uint256 private _nextTokenId = 1;

    mapping(uint256 => VerificationRequest) public verificationRequests;
    mapping(uint256 => StoredProof[]) private _storedProofs;

    event PassportMinted(uint256 indexed tokenId, address indexed owner);
    event PassportUpserted(uint256 indexed tokenId, string dataURI, bytes32 dataHash);
    event SubmittedForVerification(uint256 indexed tokenId);
    event Verified(uint256 indexed tokenId, address indexed verifier, bool approved, string verificationURI);
    event Revoked(uint256 indexed tokenId, address indexed admin, string reason);
    event VerificationRequested(uint256 indexed tokenId, VerificationMethod method);
    event VerificationFulfilled(uint256 indexed tokenId, bool approved, VerificationMethod method);

    error NotOwner();
    error NotVerifier();
    error NotAdmin();
    error PaymentRequired();

    constructor(
        IAccessManager manager,
        IERC20 _usdtToken,
        IAnalytics analyticsContract,
        IZKPVerifier _zkpVerifier
    ) ERC721("HealthPassport", "HPASS") {
        accessManager = manager;
        usdtToken = _usdtToken;
        analytics = analyticsContract;
        zkpVerifier = _zkpVerifier;
    }

    function mintPassport(
        string calldata dataURI,
        bytes32 dataHash,
        UserData calldata userData,
        IZKPVerifier.Proof[] calldata demographicProofs,
        IZKPVerifier.DemographicCategory[] calldata categories,
        uint256[] calldata values
    ) external payable returns (uint256 tokenId) {
        // Require USDT payment
        usdtToken.safeTransferFrom(msg.sender, address(this), PASSPORT_FEE);

        tokenId = _nextTokenId++;
        _mint(msg.sender, tokenId);
        _setTokenURI(tokenId, dataURI);

        Passport storage p = _passports[tokenId];
        p.dataURI = dataURI;
        p.dataHash = dataHash;
        p.createdAt = block.timestamp;
        p.updatedAt = block.timestamp;
        p.status = Status.Pending;
        p.userData = userData;

        // Submit ZK proofs for off-chain verification via zkVerify network
        if (demographicProofs.length > 0) {
            require(categories.length == demographicProofs.length && values.length == demographicProofs.length, "Arrays length mismatch");
            uint256[] memory proofIds = zkpVerifier.submitProofBatch(demographicProofs, categories, values);
            for (uint256 i = 0; i < proofIds.length; i++) {
                StoredProof storage slot = _storedProofs[tokenId].push();
                slot.proofId = proofIds[i];
                slot.category = categories[i];
                slot.value = values[i];
            }
        }

        // Update analytics
        _analytics.totalPassports++;
        analytics.updatePassportMetrics(_analytics.totalPassports, _analytics.verifiedPassports, PASSPORT_FEE);

        emit PassportMinted(tokenId, msg.sender);
        emit PassportUpserted(tokenId, dataURI, dataHash);
    }

    function upsert(uint256 tokenId, string calldata dataURI, bytes32 dataHash) external {
        if (ownerOf(tokenId) != msg.sender) revert NotOwner();

        Passport storage p = _passports[tokenId];
        p.dataURI = dataURI;
        p.dataHash = dataHash;
        p.updatedAt = block.timestamp;

        // Why: Changing data post-verification should trigger re-review.
        if (p.status == Status.Verified) {
            p.status = Status.Pending;
        }

        _setTokenURI(tokenId, dataURI);
        emit PassportUpserted(tokenId, dataURI, dataHash);
    }

    function submitForVerification(uint256 tokenId) external {
        if (ownerOf(tokenId) != msg.sender) revert NotOwner();

        verificationRequests[tokenId] = VerificationRequest({
            tokenId: tokenId,
            method: VerificationMethod.Manual,
            requestTime: block.timestamp,
            fulfilled: false,
            proof: ""
        });

        _passports[tokenId].status = Status.Pending;
        emit SubmittedForVerification(tokenId);
        emit VerificationRequested(tokenId, VerificationMethod.Manual);
    }

    function verify(uint256 tokenId, bool approved, string calldata verificationURI) external {
        if (!accessManager.isVerifier(msg.sender)) revert NotVerifier();
        Passport storage p = _passports[tokenId];
        require(p.createdAt > 0, "Passport: no record");
        bool wasVerified = p.status == Status.Verified;
        p.status = approved ? Status.Verified : Status.Rejected;
        p.lastVerifier = msg.sender;
        p.verificationURI = verificationURI;
        p.updatedAt = block.timestamp;

        if (approved && !wasVerified) {
            _analytics.verifiedPassports++;
            analytics.updatePassportMetrics(_analytics.totalPassports, _analytics.verifiedPassports, 0);

            StoredProof[] storage proofs = _storedProofs[tokenId];
            for (uint256 i = 0; i < proofs.length; i++) {
                require(zkpVerifier.isVerified(proofs[i].proofId), "Proof not verified");
                analytics.recordVerifiedDemographic(uint8(proofs[i].category), proofs[i].value, 1);
            }
        }

        verificationRequests[tokenId].fulfilled = true;
        emit Verified(tokenId, msg.sender, approved, verificationURI);
        emit VerificationFulfilled(tokenId, approved, VerificationMethod.Manual);
    }

    function revoke(uint256 tokenId, string calldata reason) external {
        // DEFAULT_ADMIN_ROLE check through AccessManager keeps admin set central
        bytes32 adminRole = accessManager.DEFAULT_ADMIN_ROLE();
        // low-level call to avoid importing AccessControl
        (bool ok, bytes memory data) = address(accessManager).staticcall(
            abi.encodeWithSignature("hasRole(bytes32,address)", adminRole, msg.sender)
        );
        require(ok && abi.decode(data, (bool)), "Not admin");

        Passport storage p = _passports[tokenId];
        require(p.createdAt > 0, "Passport: no record");
        p.status = Status.Revoked;
        p.updatedAt = block.timestamp;
        emit Revoked(tokenId, msg.sender, reason);
    }

    function isVerified(uint256 tokenId) public view override returns (bool) {
        return _passports[tokenId].status == Status.Verified;
    }

    function getUserData(uint256 tokenId) external view override returns (UserData memory) {
        if (ownerOf(tokenId) != msg.sender) revert NotOwner();
        return _passports[tokenId].userData;
    }

    function getProofRecords(uint256 tokenId)
        external
        view
        returns (
            uint256[] memory proofIds,
            IZKPVerifier.DemographicCategory[] memory categories,
            uint256[] memory values,
            bool[] memory verified
        )
    {
        StoredProof[] storage records = _storedProofs[tokenId];
        uint256 length = records.length;
        proofIds = new uint256[](length);
        categories = new IZKPVerifier.DemographicCategory[](length);
        values = new uint256[](length);
        verified = new bool[](length);

        for (uint256 i = 0; i < length; i++) {
            StoredProof storage record = records[i];
            proofIds[i] = record.proofId;
            categories[i] = record.category;
            values[i] = record.value;
            verified[i] = zkpVerifier.isVerified(record.proofId);
        }
    }

    function passportOf(uint256 tokenId) external view override returns (
        address owner,
        string memory dataURI,
        bytes32 dataHash,
        uint256 createdAt,
        uint256 updatedAt,
        Status status,
        address lastVerifier,
        string memory verificationURI
    ) {
        Passport storage p = _passports[tokenId];
        return (ownerOf(tokenId), p.dataURI, p.dataHash, p.createdAt, p.updatedAt, p.status, p.lastVerifier, p.verificationURI);
    }

    function getAnalyticsData() external view override returns (
        uint256 totalPassports,
        uint256 verifiedPassports
    ) {
        // Only admins can access analytics data
        bytes32 adminRole = accessManager.DEFAULT_ADMIN_ROLE();
        (bool ok, bytes memory data) = address(accessManager).staticcall(
            abi.encodeWithSignature("hasRole(bytes32,address)", adminRole, msg.sender)
        );
        require(ok && abi.decode(data, (bool)), "Not admin");

        return (_analytics.totalPassports, _analytics.verifiedPassports);
    }

    // ERC721 overrides
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage, IHealthPassport) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    // Internal function to extract birth year from encrypted data (for analytics)
    // This would need to be implemented based on your encryption/decryption scheme
    function _updateBirthYearAnalytics(string memory encryptedBirthDate) internal {
        // TODO: Implement birth year extraction from encrypted data
        // This might require a trusted oracle or ZKP system
    }
}
