// File: contracts/interfaces/IZKPVerifier.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IZKPVerifier {
    enum DemographicCategory {
        BirthYear,      // 0: Birth year ranges
        Nationality,    // 1: Nationality categories
        VaccineStatus,  // 2: Vaccination status
        MedicationType, // 3: Medication categories
        AllergyType,    // 4: Allergy categories
        TreatmentType   // 5: Treatment categories
    }

    struct Proof {
        uint256[2] a;        // G1 point
        uint256[2][2] b;     // G2 point
        uint256[2] c;        // G1 point
        uint256[] inputs;    // Public inputs
    }

    function verifyDemographicProof(
        Proof calldata proof,
        DemographicCategory category,
        uint256 value
    ) external returns (bool success);

    function getDemographicCount(
        DemographicCategory category,
        uint256 value
    ) external view returns (uint256 count);

    function batchVerifyDemographicProofs(
        Proof[] calldata proofs,
        DemographicCategory[] calldata categories,
        uint256[] calldata values
    ) external returns (bool[] memory successes);

    function getDemographicRangeCount(
        DemographicCategory category,
        uint256 minValue,
        uint256 maxValue
    ) external view returns (uint256 count);
}