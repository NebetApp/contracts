// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IZKPVerifier {
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

    function submitProof(
        Proof calldata proof,
        DemographicCategory category,
        uint256 value
    ) external returns (uint256 proofId);

    function submitProofBatch(
        Proof[] calldata proofs,
        DemographicCategory[] calldata categories,
        uint256[] calldata values
    ) external returns (uint256[] memory proofIds);

    function markVerified(uint256 proofId, bytes32 submissionId) external;

    function markVerifiedBatch(uint256[] calldata proofIds, bytes32[] calldata submissionIds) external;

    function isVerified(uint256 proofId) external view returns (bool);

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
        );

    function getDemographicCount(
        DemographicCategory category,
        uint256 value
    ) external view returns (uint256 count);
}
