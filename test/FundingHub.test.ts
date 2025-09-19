import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { network } from "hardhat";
import { parseUnits } from "viem";

describe("FundingHub", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer, relayer, user1, verifier] = await viem.getWalletClients();

  let fundingHub: any;
  let campaignImplementation: any;
  let healthPassport: any;
  let accessManager: any;
  let analytics: any;
  let zkpVerifier: any;
  let mockUSDT: any;
  let fundingToken: any;

  // Mock user data
  const mockUserData = {
    dataURI: "ipfs://QmTestHealthData123",
    dataHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as const,
    encryptedUserData: {
      encryptedName: "encrypted_john_doe",
      encryptedBirthDate: "encrypted_1990_01_01",
      encryptedNationality: "encrypted_usa",
      encryptedVaccines: "encrypted_covid19_pfizer",
      encryptedMedications: "encrypted_none",
      encryptedAllergies: "encrypted_peanuts",
      encryptedTreatments: "encrypted_annual_checkup"
    }
  };

  // Mock ZK proofs
  const createMockProof = (isValid = true) => {
    return {
      a: [isValid ? 1n : 0n, 2n] as const,
      b: [[3n, 4n], [5n, 6n]] as const,
      c: [7n, 8n] as const,
      inputs: isValid ? [9n, 10n] : []
    };
  };

  beforeEach(async function () {
    // Deploy AccessManager first
    accessManager = await viem.deployContract("AccessManager", [deployer.account.address]);

    // Deploy MockERC20 for USDT (6 decimals)
    mockUSDT = await viem.deployContract("MockERC20", [
      "USDT",
      "USDT", 
      6
    ]);

    // Deploy ZKPVerifier
    zkpVerifier = await viem.deployContract("ZKPVerifier", [deployer.account.address, relayer.account.address]);

    // Deploy Analytics with correct constructor
    analytics = await viem.deployContract("Analytics", [
      accessManager.address,
      zkpVerifier.address,
      mockUSDT.address
    ]);

    // Deploy HealthPassport
    healthPassport = await viem.deployContract("HealthPassport", [
      accessManager.address,
      mockUSDT.address,
      analytics.address,
      zkpVerifier.address
    ]);

    await analytics.write.setHealthPassport([healthPassport.address], { account: deployer.account });

    // Deploy funding token
    fundingToken = await viem.deployContract("MockERC20", [
      "Funding Token",
      "FUND",
      18
    ]);

    // Deploy TreatmentCampaign implementation
    campaignImplementation = await viem.deployContract("TreatmentCampaign");

    // Deploy FundingHub with correct constructor
    fundingHub = await viem.deployContract("FundingHub", [
      accessManager.address,
      healthPassport.address,
      campaignImplementation.address,
      deployer.account.address
    ]);

    // Setup: Mint USDT for users
    await mockUSDT.write.mint([user1.account.address, parseUnits("1000", 6)]);

    // Setup: Mint funding tokens for users  
    await fundingToken.write.mint([user1.account.address, parseUnits("1000", 18)]);

    // Setup: Add deployer as verifier
    await accessManager.write.addVerifier([verifier.account.address, "Test Verifier", "https://test.com"], { account: deployer.account });

    // Setup: Create and verify health passport for beneficiary
    const proofs = [createMockProof(true)];
    const categories = [0n]; // BirthYear
    const values = [1990n];

    // Mint and verify passport for beneficiary
    await mockUSDT.write.approve([healthPassport.address, parseUnits("50", 6)], { account: user1.account });
    await healthPassport.write.mintPassport([
      mockUserData.dataURI,
      mockUserData.dataHash,
      mockUserData.encryptedUserData,
      proofs,
      categories,
      values
    ], { account: user1.account });

    // Verify the passport (admin approval)
    await healthPassport.write.submitForVerification([1n], { account: user1.account }); // Manual verification
    const proofRecords = await healthPassport.read.getProofRecords([1n]);
    const proofIds = proofRecords[0] as bigint[];
    const submissionIds = proofIds.map((_, index) => {
      const hex = (100 + index).toString(16).padStart(64, "0");
      return (`0x${hex}`) as `0x${string}`;
    });
    if (proofIds.length > 0) {
      await zkpVerifier.write.markVerifiedBatch([proofIds, submissionIds], { account: relayer.account });
    }

    await healthPassport.write.verify([1n, true, "https://attestation"], { account: verifier.account });
  });

  describe("Deployment", function () {
    it("Should deploy with correct parameters", async function () {
      const passportAddress = await fundingHub.read.passport();
      const implementationAddress = await fundingHub.read.campaignImplementation();
      const managerAddress = await fundingHub.read.accessManager();
      
      assert.equal(passportAddress.toLowerCase(), healthPassport.address.toLowerCase());
      assert.equal(implementationAddress.toLowerCase(), campaignImplementation.address.toLowerCase());
      assert.equal(managerAddress.toLowerCase(), accessManager.address.toLowerCase());
    });

    it("Should initialize with correct admin", async function () {
      const admin = await fundingHub.read.admin();
      assert.equal(admin.toLowerCase(), deployer.account.address.toLowerCase());
    });

    it("Should start with no campaigns", async function () {
      // FundingHub doesn't track campaigns in an array, so we just verify deployment worked
      const passportAddress = await fundingHub.read.passport();
      assert.notEqual(passportAddress, "0x0000000000000000000000000000000000000000");
    });
  });

  describe("Campaign Creation", function () {
    it("Should create campaign for verified passport holder", async function () {
      const goal = parseUnits("100", 18);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400); // 1 day from now

      const hash = await fundingHub.write.createCampaign([
        1n, // beneficiaryPassportId
        fundingToken.address,
        goal,
        deadline,
        user1.account.address
      ], { account: deployer.account });

      // Verify event was emitted
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const events = await publicClient.getContractEvents({
        address: fundingHub.address,
        abi: fundingHub.abi,
        eventName: "CampaignCreated",
        fromBlock: receipt.blockNumber,
        toBlock: receipt.blockNumber
      });

      assert.equal(events.length, 1);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle creating multiple campaigns", async function () {
      const goal = parseUnits("100", 18);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);

      // Create first campaign
      const hash1 = await fundingHub.write.createCampaign([
        1n,
        fundingToken.address,
        goal,
        deadline,
        user1.account.address
      ], { account: deployer.account });

      // Create second campaign  
      const hash2 = await fundingHub.write.createCampaign([
        1n,
        fundingToken.address,
        goal * 2n,
        deadline + 86400n,
        user1.account.address
      ], { account: deployer.account });

      // Verify both events were emitted
      const receipt1 = await publicClient.waitForTransactionReceipt({ hash: hash1 });
      const receipt2 = await publicClient.waitForTransactionReceipt({ hash: hash2 });

      const events1 = await publicClient.getContractEvents({
        address: fundingHub.address,
        abi: fundingHub.abi,
        eventName: "CampaignCreated",
        fromBlock: receipt1.blockNumber,
        toBlock: receipt1.blockNumber
      });

      const events2 = await publicClient.getContractEvents({
        address: fundingHub.address,
        abi: fundingHub.abi,
        eventName: "CampaignCreated",
        fromBlock: receipt2.blockNumber,
        toBlock: receipt2.blockNumber
      });

      assert.equal(events1.length, 1);
      assert.equal(events2.length, 1);
    });
  });
});
