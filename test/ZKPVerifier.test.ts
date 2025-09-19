import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { network } from "hardhat";
import { Address } from "viem";

describe("ZKPVerifier", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer, user1, user2] = await viem.getWalletClients();

  let zkpVerifier: any;

  // Mock ZK proof structure for testing
  const createMockProof = (isValid = true) => {
    return {
      a: [isValid ? 1n : 0n, 2n],
      b: [[3n, 4n], [5n, 6n]],
      c: [7n, 8n],
      inputs: isValid ? [9n, 10n] : []
    };
  };

  beforeEach(async function () {
    zkpVerifier = await viem.deployContract("ZKPVerifier");
  });

  describe("Deployment", function () {
    it("Should deploy successfully", async function () {
      assert.ok(zkpVerifier.address);
    });
  });

  describe("Single Proof Verification", function () {
    it("Should verify valid demographic proof", async function () {
      const proof = createMockProof(true);
      const category = 0; // BirthYear
      const value = 1990;

      const result = await zkpVerifier.write.verifyDemographicProof([proof, category, value]);
      
      // Check that the proof was recorded
      const count = await zkpVerifier.read.getDemographicCount([category, value]);
      assert.equal(count, 1n);
    });

    it("Should reject invalid demographic proof", async function () {
      const proof = createMockProof(false);
      const category = 0; // BirthYear
      const value = 1990;

      await zkpVerifier.write.verifyDemographicProof([proof, category, value]);
      
      // Count should still be 0 for invalid proof
      const count = await zkpVerifier.read.getDemographicCount([category, value]);
      assert.equal(count, 0n);
    });

    it("Should track different demographic categories", async function () {
      const proof = createMockProof(true);

      // Test different categories
      await zkpVerifier.write.verifyDemographicProof([proof, 0, 1990]); // BirthYear
      await zkpVerifier.write.verifyDemographicProof([proof, 1, 1]); // Nationality
      await zkpVerifier.write.verifyDemographicProof([proof, 2, 1]); // VaccineStatus

      const birthYearCount = await zkpVerifier.read.getDemographicCount([0, 1990]);
      const nationalityCount = await zkpVerifier.read.getDemographicCount([1, 1]);
      const vaccineCount = await zkpVerifier.read.getDemographicCount([2, 1]);

      assert.equal(birthYearCount, 1n);
      assert.equal(nationalityCount, 1n);
      assert.equal(vaccineCount, 1n);
    });

    it("Should accumulate counts for same demographic", async function () {
      const proof = createMockProof(true);
      const category = 0; // BirthYear
      const value = 1990;

      // Submit multiple proofs for same demographic
      await zkpVerifier.write.verifyDemographicProof([proof, category, value], { account: user1.account });
      await zkpVerifier.write.verifyDemographicProof([proof, category, value], { account: user2.account });

      const count = await zkpVerifier.read.getDemographicCount([category, value]);
      assert.equal(count, 2n);
    });
  });

  describe("Batch Proof Verification", function () {
    it("Should verify multiple proofs in batch", async function () {
      const proofs = [createMockProof(true), createMockProof(true), createMockProof(false)];
      const categories = [0, 1, 2]; // BirthYear, Nationality, VaccineStatus
      const values = [1990, 1, 1];

      const results = await zkpVerifier.write.batchVerifyDemographicProofs([proofs, categories, values]);

      // Check individual counts
      const birthYearCount = await zkpVerifier.read.getDemographicCount([0, 1990]);
      const nationalityCount = await zkpVerifier.read.getDemographicCount([1, 1]);
      const vaccineCount = await zkpVerifier.read.getDemographicCount([2, 1]);

      assert.equal(birthYearCount, 1n); // Valid proof
      assert.equal(nationalityCount, 1n); // Valid proof
      assert.equal(vaccineCount, 0n); // Invalid proof
    });

    it("Should require matching array lengths", async function () {
      const proofs = [createMockProof(true)];
      const categories = [0, 1]; // Mismatched length
      const values = [1990];

      try {
        await zkpVerifier.write.batchVerifyDemographicProofs([proofs, categories, values]);
        assert.fail("Should have thrown an error");
      } catch (error: any) {
        assert.ok(error.message.includes("Array length mismatch"));
      }
    });

    it("Should handle empty batch", async function () {
      const results = await zkpVerifier.write.batchVerifyDemographicProofs([[], [], []]);
      // Should not throw error
      assert.ok(true);
    });
  });

  describe("Demographic Queries", function () {
    beforeEach(async function () {
      // Set up test data
      const proof = createMockProof(true);
      
      // Add some birth year data
      await zkpVerifier.write.verifyDemographicProof([proof, 0, 1990]);
      await zkpVerifier.write.verifyDemographicProof([proof, 0, 1991]);
      await zkpVerifier.write.verifyDemographicProof([proof, 0, 1992]);
      await zkpVerifier.write.verifyDemographicProof([proof, 0, 1995]);
      await zkpVerifier.write.verifyDemographicProof([proof, 0, 1990]); // Duplicate year
    });

    it("Should return correct demographic count", async function () {
      const count1990 = await zkpVerifier.read.getDemographicCount([0, 1990]);
      const count1995 = await zkpVerifier.read.getDemographicCount([0, 1995]);
      const countNonExistent = await zkpVerifier.read.getDemographicCount([0, 2000]);

      assert.equal(count1990, 2n); // Two proofs for 1990
      assert.equal(count1995, 1n);
      assert.equal(countNonExistent, 0n);
    });

    it("Should return correct range count", async function () {
      // Count for 1990-1992 range
      const rangeCount = await zkpVerifier.read.getDemographicRangeCount([0, 1990, 1992]);
      assert.equal(rangeCount, 4n); // 2 + 1 + 1 (1990, 1991, 1992)

      // Count for 1993-1994 range (empty)
      const emptyRangeCount = await zkpVerifier.read.getDemographicRangeCount([0, 1993, 1994]);
      assert.equal(emptyRangeCount, 0n);

      // Single value range
      const singleValueCount = await zkpVerifier.read.getDemographicRangeCount([0, 1995, 1995]);
      assert.equal(singleValueCount, 1n);
    });

    it("Should handle different categories independently", async function () {
      const proof = createMockProof(true);
      
      // Add nationality data
      await zkpVerifier.write.verifyDemographicProof([proof, 1, 1]); // Nationality category
      await zkpVerifier.write.verifyDemographicProof([proof, 1, 2]);

      // Birth year and nationality should be separate
      const birthYearCount = await zkpVerifier.read.getDemographicCount([0, 1990]);
      const nationalityCount = await zkpVerifier.read.getDemographicCount([1, 1]);

      assert.equal(birthYearCount, 2n); // From beforeEach
      assert.equal(nationalityCount, 1n); // From this test
    });
  });

  describe("Edge Cases", function () {
    it("Should handle zero value demographic", async function () {
      const proof = createMockProof(true);
      await zkpVerifier.write.verifyDemographicProof([proof, 0, 0]);

      const count = await zkpVerifier.read.getDemographicCount([0, 0]);
      assert.equal(count, 1n);
    });

    it("Should handle large values", async function () {
      const proof = createMockProof(true);
      const largeValue = 999999999n;
      
      await zkpVerifier.write.verifyDemographicProof([proof, 0, largeValue]);

      const count = await zkpVerifier.read.getDemographicCount([0, largeValue]);
      assert.equal(count, 1n);
    });

    it("Should handle all demographic categories", async function () {
      const proof = createMockProof(true);
      
      // Test all 6 categories (0-5)
      for (let category = 0; category < 6; category++) {
        await zkpVerifier.write.verifyDemographicProof([proof, category, 1]);
        const count = await zkpVerifier.read.getDemographicCount([category, 1]);
        assert.equal(count, 1n);
      }
    });
  });

  describe("Gas Optimization", function () {
    it("Should handle batch operations efficiently", async function () {
      const proofs = Array(10).fill(0).map(() => createMockProof(true));
      const categories = Array(10).fill(0); // All BirthYear
      const values = Array(10).fill(0).map((_, i) => 1990 + i);

      // This should not run out of gas
      await zkpVerifier.write.batchVerifyDemographicProofs([proofs, categories, values]);

      // Verify all were processed
      for (let i = 0; i < 10; i++) {
        const count = await zkpVerifier.read.getDemographicCount([0, 1990 + i]);
        assert.equal(count, 1n);
      }
    });
  });
});