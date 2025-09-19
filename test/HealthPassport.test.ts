import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { network } from "hardhat";

const BIRTH_YEAR = 0;

const mockUserData = {
  dataURI: "ipfs://QmHealthData",
  dataHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  encryptedUserData: {
    encryptedName: "wallet://0x",
    encryptedBirthDate: "wallet://0x",
    encryptedNationality: "wallet://0x",
    encryptedVaccines: "wallet://0x",
    encryptedMedications: "wallet://0x",
    encryptedAllergies: "wallet://0x",
    encryptedTreatments: "wallet://0x"
  }
};

const createMockProof = () => ({
  a: [1n, 2n],
  b: [
    [3n, 4n],
    [5n, 6n]
  ],
  c: [7n, 8n],
  inputs: [9n, 10n]
});

describe("HealthPassport", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [admin, relayer, patient, verifier] = await viem.getWalletClients();

  let accessManager: any;
  let analytics: any;
  let zkpVerifier: any;
  let mockUSDT: any;
  let healthPassport: any;

  const passportFee = 50n * 10n ** 6n;

  async function deploySuite() {
    accessManager = await viem.deployContract("AccessManager", [admin.account.address]);
    zkpVerifier = await viem.deployContract("ZKPVerifier", [admin.account.address, relayer.account.address]);
    mockUSDT = await viem.deployContract("MockERC20", ["USDT", "USDT", 6]);
    analytics = await viem.deployContract("Analytics", [accessManager.address, zkpVerifier.address, mockUSDT.address]);
    healthPassport = await viem.deployContract("HealthPassport", [
      accessManager.address,
      mockUSDT.address,
      analytics.address,
      zkpVerifier.address
    ]);

    await analytics.write.setHealthPassport([healthPassport.address], { account: admin.account });
    await accessManager.write.addVerifier([verifier.account.address, "Verifier", "https://verifier.example"], { account: admin.account });

    await mockUSDT.write.mint([patient.account.address, passportFee * 10n]);
    await mockUSDT.write.approve([healthPassport.address, passportFee * 10n], { account: patient.account });
  }

  async function markProofsVerified(tokenId: bigint) {
    const records = await healthPassport.read.getProofRecords([tokenId]);
    const proofIds = records[0] as bigint[];
    if (proofIds.length === 0) return;
    const submissionIds = proofIds.map((_, index) => {
      const hex = (10n + BigInt(index)).toString(16).padStart(64, "0");
      return (`0x${hex}`) as `0x${string}`;
    });
    await zkpVerifier.write.markVerifiedBatch([proofIds, submissionIds], { account: relayer.account });
  }

  beforeEach(async function () {
    await deploySuite();
  });

  it("mints passports and records proof submissions", async function () {
    const proofs = [createMockProof(), createMockProof()];
    const categories = [BIRTH_YEAR, 1];
    const values = [1990n, 1n];

    const hash = await healthPassport.write.mintPassport([
      mockUserData.dataURI,
      mockUserData.dataHash,
      mockUserData.encryptedUserData,
      proofs,
      categories,
      values
    ], { account: patient.account });
    await publicClient.waitForTransactionReceipt({ hash });

    const owner = await healthPassport.read.ownerOf([1n]);
    assert.equal(owner.toLowerCase(), patient.account.address.toLowerCase());

    const records = await healthPassport.read.getProofRecords([1n]);
    const proofIds = records[0] as bigint[];
    const storedCategories = records[1] as number[];
    const storedValues = records[2] as bigint[];

    assert.equal(proofIds.length, 2);
    assert.equal(storedCategories[0], BIRTH_YEAR);
    assert.equal(storedValues[0], 1990n);
  });

  it("prevents approval before zk proofs are verified", async function () {
    const hash = await healthPassport.write.mintPassport([
      mockUserData.dataURI,
      mockUserData.dataHash,
      mockUserData.encryptedUserData,
      [createMockProof()],
      [BIRTH_YEAR],
      [1990n]
    ], { account: patient.account });
    await publicClient.waitForTransactionReceipt({ hash });

    await assert.rejects(
      healthPassport.write.verify([1n, true, "https://attestation"], { account: verifier.account }),
      /Proof not verified/
    );
  });

  it("approves passports once zkVerify attests proofs", async function () {
    await healthPassport.write.mintPassport([
      mockUserData.dataURI,
      mockUserData.dataHash,
      mockUserData.encryptedUserData,
      [createMockProof()],
      [BIRTH_YEAR],
      [1990n]
    ], { account: patient.account });

    await markProofsVerified(1n);

    await healthPassport.write.verify([1n, true, "https://attestation"], { account: verifier.account });

    const status = await healthPassport.read.isVerified([1n]);
    assert.equal(status, true);

    const metrics = await analytics.read.getGlobalMetrics();
    assert.equal(metrics[0], 1n); // total passports
    assert.equal(metrics[1], 1n); // verified passports

    const count = await analytics.read.getVerifiedDemographicCount([BigInt(BIRTH_YEAR), 1990n]);
    assert.equal(count, 1n);
  });

  it("allows revocation by admin", async function () {
    await healthPassport.write.mintPassport([
      mockUserData.dataURI,
      mockUserData.dataHash,
      mockUserData.encryptedUserData,
      [createMockProof()],
      [BIRTH_YEAR],
      [1990n]
    ], { account: patient.account });

    await markProofsVerified(1n);
    await healthPassport.write.verify([1n, true, "https://attestation"], { account: verifier.account });
    await healthPassport.write.revoke([1n, "fraud"], { account: admin.account });

    const passportData = await healthPassport.read.passportOf([1n]);
    assert.equal(passportData[5], 4); // Status.Revoked
  });

  it("restricts user data access to passport owner", async function () {
    await healthPassport.write.mintPassport([
      mockUserData.dataURI,
      mockUserData.dataHash,
      mockUserData.encryptedUserData,
      [createMockProof()],
      [BIRTH_YEAR],
      [1990n]
    ], { account: patient.account });

    const data = await healthPassport.read.getUserData([1n], { account: patient.account });
    assert.equal(data.encryptedName, mockUserData.encryptedUserData.encryptedName);

    await assert.rejects(
      healthPassport.read.getUserData([1n], { account: verifier.account }),
      /NotOwner/
    );
  });
});
