// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ZKPVerifier (zkVerify adapter)
 * @notice Offloads proof verification to the zkVerify network and records
 *         verified demographic aggregates on-chain once a trusted relayer
 *         confirms completion.
 */
contract ZKPVerifier {
    enum DemographicCategory {
        BirthYear,
        Nationality,
        VaccineStatus,
        MedicationType,
        AllergyType,
        TreatmentType
    }

    struct Proof {
        uint256[2] a;
        uint256[2][2] b;
        uint256[2] c;
        uint256[] inputs;
    }

    struct ProofRecord {
        address submitter;
        DemographicCategory category;
        uint256 value;
        bytes32 proofHash;
        bytes32 submissionId;
        bool verified;
    }

    address public admin;
    address public relayer;

    uint256 public nextProofId = 1;

    mapping(uint256 => ProofRecord) private _proofs;
    mapping(DemographicCategory => mapping(uint256 => uint256)) public verifiedDemographics;

    event ProofSubmitted(
        uint256 indexed proofId,
        address indexed submitter,
        DemographicCategory indexed category,
        uint256 value,
        bytes32 proofHash
    );

    event ProofVerified(uint256 indexed proofId, bytes32 submissionId);
    event RelayerUpdated(address indexed newRelayer);
    event AdminUpdated(address indexed newAdmin);

    error NotAdmin();
    error NotRelayer();
    error InvalidArrays();
    error ProofNotFound();
    error AlreadyVerified();

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier onlyRelayer() {
        if (msg.sender != relayer) revert NotRelayer();
        _;
    }

    constructor(address admin_, address relayer_) {
        admin = admin_;
        relayer = relayer_;
    }

    function setRelayer(address newRelayer) external onlyAdmin {
        relayer = newRelayer;
        emit RelayerUpdated(newRelayer);
    }

    function setAdmin(address newAdmin) external onlyAdmin {
        admin = newAdmin;
        emit AdminUpdated(newAdmin);
    }

    function submitProof(
        Proof calldata proof,
        DemographicCategory category,
        uint256 value
    ) public returns (uint256 proofId) {
        proofId = nextProofId++;
        bytes32 proofHash = keccak256(
            abi.encode(proof.a, proof.b, proof.c, proof.inputs, category, value)
        );

        _proofs[proofId] = ProofRecord({
            submitter: msg.sender,
            category: category,
            value: value,
            proofHash: proofHash,
            submissionId: bytes32(0),
            verified: false
        });

        emit ProofSubmitted(proofId, msg.sender, category, value, proofHash);
    }

    function submitProofBatch(
        Proof[] calldata proofs,
        DemographicCategory[] calldata categories,
        uint256[] calldata values
    ) external returns (uint256[] memory proofIds) {
        if (proofs.length != categories.length || categories.length != values.length) {
            revert InvalidArrays();
        }

        proofIds = new uint256[](proofs.length);
        for (uint256 i = 0; i < proofs.length; i++) {
            proofIds[i] = submitProof(proofs[i], categories[i], values[i]);
        }
    }

    function markVerified(uint256 proofId, bytes32 submissionId) public onlyRelayer {
        ProofRecord storage record = _proofs[proofId];
        if (record.submitter == address(0)) revert ProofNotFound();
        if (record.verified) revert AlreadyVerified();

        record.verified = true;
        record.submissionId = submissionId;
        verifiedDemographics[record.category][record.value] += 1;

        emit ProofVerified(proofId, submissionId);
    }

    function markVerifiedBatch(uint256[] calldata proofIds, bytes32[] calldata submissionIds) external onlyRelayer {
        if (proofIds.length != submissionIds.length) revert InvalidArrays();
        for (uint256 i = 0; i < proofIds.length; i++) {
            markVerified(proofIds[i], submissionIds[i]);
        }
    }

    function isVerified(uint256 proofId) external view returns (bool) {
        return _proofs[proofId].verified;
    }

    function proofInfo(uint256 proofId)
        external
        view
        returns (
            address submitter,
            DemographicCategory category,
            uint256 value,
            bytes32 proofHash,
            bool verified,
            bytes32 submissionId
        )
    {
        ProofRecord storage record = _proofs[proofId];
        if (record.submitter == address(0)) revert ProofNotFound();
        return (
            record.submitter,
            record.category,
            record.value,
            record.proofHash,
            record.verified,
            record.submissionId
        );
    }

    function getDemographicCount(
        DemographicCategory category,
        uint256 value
    ) external view returns (uint256 count) {
        return verifiedDemographics[category][value];
    }
}
