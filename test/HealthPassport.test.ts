import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { network } from "hardhat";
import { Address } from "viem";

describe("HealthPassport", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer, user1, user2, verifier] = await viem.getWalletClients();

  let healthPassport: any;
  let accessManager: any;
  let analytics: any;
  let zkpVerifier: any;
  let mockUSDT: any;

  // Mock user data
  const mockUserData = {
    dataURI: "ipfs://QmTestHealthData123",
    dataHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
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
      a: [isValid ? 1n : 0n, 2n],
      b: [[3n, 4n], [5n, 6n]],
      c: [7n, 8n],
      inputs: isValid ? [9n, 10n] : []
    };
  };

  const passportFee = 50n * 10n ** 6n; // 50 USDT (6 decimals)

  beforeEach(async function () {
    // Deploy AccessManager
    accessManager = await viem.deployContract("AccessManager", [deployer.account.address]);
    
    // Deploy mock USDT token
    mockUSDT = await viem.deployContract("MockERC20", ["USDT", "USDT", 6]);
    
    // Deploy ZKPVerifier
    zkpVerifier = await viem.deployContract("ZKPVerifier");
    
    // Deploy Analytics
    analytics = await viem.deployContract("Analytics", [accessManager.address, zkpVerifier.address, mockUSDT.address]);
    
    // Deploy HealthPassport
    healthPassport = await viem.deployContract("HealthPassport", [
      accessManager.address,
      mockUSDT.address,
      analytics.address,
      zkpVerifier.address
    ]);

    // Mint USDT to test accounts
    await mockUSDT.write.mint([user1.account.address, 1000n * 10n ** 6n]);
    await mockUSDT.write.mint([user2.account.address, 1000n * 10n ** 6n]);

    // Add verifier to AccessManager
    await accessManager.write.addVerifier([verifier.account.address, "Test Clinic", "https://testclinic.com"]);
  });

  describe("Deployment", function () {
    it("Should deploy with correct parameters", async function () {
      const accessManagerAddress = await healthPassport.read.accessManager();
      const usdtAddress = await healthPassport.read.usdtToken();
      const analyticsAddress = await healthPassport.read.analytics();
      const zkpAddress = await healthPassport.read.zkpVerifier();
      
      assert.equal(accessManagerAddress.toLowerCase(), accessManager.address.toLowerCase());
      assert.equal(usdtAddress.toLowerCase(), mockUSDT.address.toLowerCase());
      assert.equal(analyticsAddress.toLowerCase(), analytics.address.toLowerCase());
      assert.equal(zkpAddress.toLowerCase(), zkpVerifier.address.toLowerCase());
    });

    it("Should initialize with correct passport fee", async function () {
      const fee = await healthPassport.read.PASSPORT_FEE();
      assert.equal(fee, passportFee);
    });

    it("Should start with token ID 1", async function () {
      // Since _nextTokenId is private, we'll check by minting the first token
      const proofs = [createMockProof(true)];
      const categories = [0];
      const values = [1990];

      await mockUSDT.write.approve([healthPassport.address, passportFee], { account: user1.account });
      
      await healthPassport.write.mintPassport([
        mockUserData.dataURI,
        mockUserData.dataHash,
        mockUserData.encryptedUserData,
        proofs,
        categories,
        values
      ], { account: user1.account });

      // Check that the first token exists and has ID 1
      const owner = await healthPassport.read.ownerOf([1n]);
      assert.equal(owner.toLowerCase(), user1.account.address.toLowerCase());
    });
  });

  describe("Passport Minting", function () {
    it("Should mint passport with valid payment and ZK proofs", async function () {
      const proofs = [createMockProof(true), createMockProof(true)];
      const categories = [0, 1]; // BirthYear, Nationality
      const values = [1990, 1];

      // Approve USDT spending
      await mockUSDT.write.approve([healthPassport.address, passportFee], { account: user1.account });

      // Get initial balances
      const initialUserBalance = await mockUSDT.read.balanceOf([user1.account.address]);
      const initialContractBalance = await mockUSDT.read.balanceOf([healthPassport.address]);

      // Mint passport
      await healthPassport.write.mintPassport([
        mockUserData.dataURI,
        mockUserData.dataHash,
        mockUserData.encryptedUserData,
        proofs,
        categories,
        values
      ], { account: user1.account });

      // Check NFT was minted
      const tokenId = 1n;
      const owner = await healthPassport.read.ownerOf([tokenId]);
      assert.equal(owner.toLowerCase(), user1.account.address.toLowerCase());

      // Check balance changes
      const finalUserBalance = await mockUSDT.read.balanceOf([user1.account.address]);
      const finalContractBalance = await mockUSDT.read.balanceOf([healthPassport.address]);
      
      assert.equal(finalUserBalance, initialUserBalance - passportFee);
      assert.equal(finalContractBalance, initialContractBalance + passportFee);

      // Check next token ID incremented by trying to mint with the same user
      // and verifying it gets token ID 2
      const proofs2 = [createMockProof(true)];
      const categories2 = [0];
      const values2 = [1995];

      await mockUSDT.write.mint([user1.account.address, passportFee]);
      await mockUSDT.write.approve([healthPassport.address, passportFee], { account: user1.account });
      
      await healthPassport.write.mintPassport([
        mockUserData.dataURI,
        mockUserData.dataHash,
        mockUserData.encryptedUserData,
        proofs2,
        categories2,
        values2
      ], { account: user1.account });

      // Verify the second token exists with ID 2
      const secondOwner = await healthPassport.read.ownerOf([2n]);
      assert.equal(secondOwner.toLowerCase(), user1.account.address.toLowerCase());
    });

    it("Should store passport data correctly", async function () {
      const proofs = [createMockProof(true)];
      const categories = [0]; // BirthYear
      const values = [1990];

      await mockUSDT.write.approve([healthPassport.address, passportFee], { account: user1.account });
      
      await healthPassport.write.mintPassport([
        mockUserData.dataURI,
        mockUserData.dataHash,
        mockUserData.encryptedUserData,
        proofs,
        categories,
        values
      ], { account: user1.account });

      const tokenId = 1n;
      const passportData = await healthPassport.read.passportOf([tokenId]);
      
      assert.equal(passportData[0].toLowerCase(), user1.account.address.toLowerCase()); // owner
      assert.equal(passportData[1], mockUserData.dataURI); // dataURI
      assert.equal(passportData[2], mockUserData.dataHash); // dataHash
      assert.equal(passportData[5], 1); // status (Pending = 1)
    });

    it("Should not allow minting without sufficient USDT allowance", async function () {
      const proofs = [createMockProof(true)];
      const categories = [0];
      const values = [1990];

      // Approve insufficient amount
      await mockUSDT.write.approve([healthPassport.address, passportFee - 1n], { account: user1.account });

      try {
        await healthPassport.write.mintPassport([
        mockUserData.dataURI,
        mockUserData.dataHash,
        mockUserData.encryptedUserData,
        proofs,
          categories,
          values
        ], { account: user1.account });
        assert.fail("Should have thrown an error");
      } catch (error: any) {
        assert.ok(error.message.includes("allowance") || error.message.includes("transfer") || error.message.includes("ERC20InsufficientAllowance"));
      }
    });

    it("Should not allow minting without sufficient USDT balance", async function () {
      const proofs = [createMockProof(true)];
      const categories = [0];
      const values = [1990];

      // Deploy account with no balance
      const [poorUser] = await viem.getWalletClients();

      await mockUSDT.write.approve([healthPassport.address, passportFee], { account: poorUser.account });

      try {
        await healthPassport.write.mintPassport([
        mockUserData.dataURI,
        mockUserData.dataHash,
        mockUserData.encryptedUserData,
        proofs,
          categories,
          values
        ], { account: poorUser.account });
        assert.fail("Should have thrown an error");
      } catch (error: any) {
        assert.ok(error.message.includes("balance") || error.message.includes("transfer") || error.message.includes("ERC20InsufficientBalance"));
      }
    });

    it("Should handle empty ZK proofs array", async function () {
      await mockUSDT.write.approve([healthPassport.address, passportFee], { account: user1.account });
      
      await healthPassport.write.mintPassport([
        mockUserData.dataURI,
        mockUserData.dataHash,
        mockUserData.encryptedUserData,
        [], // Empty proofs
        [], // Empty categories
        []  // Empty values
      ], { account: user1.account });

      const tokenId = 1n;
      const owner = await healthPassport.read.ownerOf([tokenId]);
      assert.equal(owner.toLowerCase(), user1.account.address.toLowerCase());
    });
  });

  describe("User Data Access", function () {
    let tokenId: bigint;

    beforeEach(async function () {
      const proofs = [createMockProof(true)];
      const categories = [0];
      const values = [1990];

      await mockUSDT.write.approve([healthPassport.address, passportFee], { account: user1.account });
      
      await healthPassport.write.mintPassport([
        mockUserData.dataURI,
        mockUserData.dataHash,
        mockUserData.encryptedUserData,
        proofs,
        categories,
        values
      ], { account: user1.account });

      tokenId = 1n;
    });

    it("Should allow NFT owner to access their data", async function () {
      const userData = await healthPassport.read.getUserData([tokenId], { account: user1.account });
      
      // The getUserData function returns a UserData struct with encrypted fields
      assert.equal(userData.encryptedName, mockUserData.encryptedUserData.encryptedName);
      assert.equal(userData.encryptedBirthDate, mockUserData.encryptedUserData.encryptedBirthDate);
    });

    it("Should not allow non-owner to access data", async function () {
      let errorThrown = false;
      try {
        await healthPassport.read.getUserData([tokenId], { account: user2.account });
      } catch (error: any) {
        errorThrown = true;
        // Should throw NotOwner error
      }
      assert.ok(errorThrown, "Should have thrown an error");
    });

    it("Should not allow access to non-existent passport", async function () {
      try {
        await healthPassport.read.getUserData([999n], { account: user1.account });
        assert.fail("Should have thrown an error");
      } catch (error: any) {
        assert.ok(error.message.includes("ERC721NonexistentToken") || error.message.includes("token"));
      }
    });
  });

  describe("Verification Workflow", function () {
    let tokenId: bigint;

    beforeEach(async function () {
      const proofs = [createMockProof(true)];
      const categories = [0];
      const values = [1990];

      await mockUSDT.write.approve([healthPassport.address, passportFee], { account: user1.account });
      
      await healthPassport.write.mintPassport([
        mockUserData.dataURI,
        mockUserData.dataHash,
        mockUserData.encryptedUserData,
        proofs,
        categories,
        values
      ], { account: user1.account });

      tokenId = 1n;
    });

    it("Should allow passport owner to request verification", async function () {
      const verificationURI = "ipfs://QmVerificationData123";
      
      await healthPassport.write.submitForVerification([tokenId], { account: user1.account }); // Manual verification

      const request = await healthPassport.read.verificationRequests([tokenId]);
      assert.equal(request[1], 0); // VerificationMethod.Manual (index 1 in struct)
      assert.equal(request[3], false); // fulfilled (index 3 in struct)
    });

    it("Should not allow non-owner to request verification", async function () {
      let errorThrown = false;
      try {
        await healthPassport.write.submitForVerification([tokenId], { account: user2.account });
      } catch (error: any) {
        errorThrown = true;
        // Should throw NotOwner error
      }
      assert.ok(errorThrown, "Should have thrown an error");
    });

    it("Should allow verifier to approve verification", async function () {
      const verificationURI = "ipfs://QmVerificationData123";
      
      // Request verification first
      await healthPassport.write.submitForVerification([tokenId], { account: user1.account });

      // Approve verification as verifier
      await healthPassport.write.verify([tokenId, true, "ipfs://QmApprovalData"], { account: verifier.account });

      // Check passport status
      const passportData = await healthPassport.read.passportOf([tokenId]);
      assert.equal(passportData[5], 2); // Status.Verified

      // Check verification request fulfilled
      const request = await healthPassport.read.verificationRequests([tokenId]);
      assert.equal(request[3], true); // fulfilled
    });

    it("Should allow verifier to reject verification", async function () {
      const verificationURI = "ipfs://QmVerificationData123";
      
      // Request verification first
      await healthPassport.write.submitForVerification([tokenId], { account: user1.account });

      // Reject verification as verifier
      await healthPassport.write.verify([tokenId, false, "ipfs://QmRejectionReason"], { account: verifier.account });

      // Check passport status
      const passportData = await healthPassport.read.passportOf([tokenId]);
      assert.equal(passportData[5], 3); // Status.Rejected
    });

    it("Should not allow non-verifier to approve verification", async function () {
      const verificationURI = "ipfs://QmVerificationData123";
      
      // Request verification first
      await healthPassport.write.submitForVerification([tokenId], { account: user1.account });

      let errorThrown = false;
      try {
        await healthPassport.write.verify([tokenId, true, "ipfs://QmApprovalData"], { account: user2.account });
      } catch (error: any) {
        errorThrown = true;
        // Should throw NotVerifier error
      }
      assert.ok(errorThrown, "Should have thrown an error");
    });
  });

  describe("ERC721 Compliance", function () {
    let tokenId: bigint;

    beforeEach(async function () {
      const proofs = [createMockProof(true)];
      const categories = [0];
      const values = [1990];

      await mockUSDT.write.approve([healthPassport.address, passportFee], { account: user1.account });
      
      await healthPassport.write.mintPassport([
        mockUserData.dataURI,
        mockUserData.dataHash,
        mockUserData.encryptedUserData,
        proofs,
        categories,
        values
      ], { account: user1.account });

      tokenId = 1n;
    });

    it("Should support ERC721 interface", async function () {
      const erc721InterfaceId = "0x80ac58cd";
      const supportsInterface = await healthPassport.read.supportsInterface([erc721InterfaceId]);
      assert.equal(supportsInterface, true);
    });

    it("Should allow token transfers", async function () {
      // Approve transfer
      await healthPassport.write.approve([user2.account.address, tokenId], { account: user1.account });
      
      // Transfer token
      await healthPassport.write.transferFrom([user1.account.address, user2.account.address, tokenId], { account: user1.account });

      // Check new owner
      const newOwner = await healthPassport.read.ownerOf([tokenId]);
      assert.equal(newOwner.toLowerCase(), user2.account.address.toLowerCase());
    });

    it("Should update balance after transfer", async function () {
      const initialBalance1 = await healthPassport.read.balanceOf([user1.account.address]);
      const initialBalance2 = await healthPassport.read.balanceOf([user2.account.address]);

      // Transfer token
      await healthPassport.write.transferFrom([user1.account.address, user2.account.address, tokenId], { account: user1.account });

      const finalBalance1 = await healthPassport.read.balanceOf([user1.account.address]);
      const finalBalance2 = await healthPassport.read.balanceOf([user2.account.address]);

      assert.equal(finalBalance1, initialBalance1 - 1n);
      assert.equal(finalBalance2, initialBalance2 + 1n);
    });
  });

  describe("Analytics Integration", function () {
    it("Should update analytics metrics when minting passport", async function () {
      const proofs = [createMockProof(true)];
      const categories = [0];
      const values = [1990];

      await mockUSDT.write.approve([healthPassport.address, passportFee], { account: user1.account });
      
      await healthPassport.write.mintPassport([
        mockUserData.dataURI,
        mockUserData.dataHash,
        mockUserData.encryptedUserData,
        proofs,
        categories,
        values
      ], { account: user1.account });

      // Check analytics were updated
      const metrics = await analytics.read.getGlobalMetrics();
      assert.equal(metrics[0], 1n); // totalPassports
      assert.equal(metrics[1], 0n); // verifiedPassports (not verified yet)
      assert.equal(metrics[2], passportFee); // totalRevenue
    });

    it("Should update analytics when passport is verified", async function () {
      const proofs = [createMockProof(true)];
      const categories = [0];
      const values = [1990];

      await mockUSDT.write.approve([healthPassport.address, passportFee], { account: user1.account });
      
      await healthPassport.write.mintPassport([
        mockUserData.dataURI,
        mockUserData.dataHash,
        mockUserData.encryptedUserData,
        proofs,
        categories,
        values
      ], { account: user1.account });

      const tokenId = 1n;

      // Request and approve verification
      await healthPassport.write.submitForVerification([tokenId], { account: user1.account });
      await healthPassport.write.verify([tokenId, true, "ipfs://approval"], { account: verifier.account });

      // Check analytics updated with verified count
      const metrics = await analytics.read.getGlobalMetrics();
      assert.equal(metrics[0], 1n); // totalPassports
      assert.equal(metrics[1], 1n); // verifiedPassports (now verified)
    });
  });

  describe("Edge Cases", function () {
    it("Should handle multiple passport minting by same user", async function () {
      const proofs = [createMockProof(true)];
      const categories = [0];
      const values = [1990];

      // Mint first passport
      await mockUSDT.write.approve([healthPassport.address, passportFee], { account: user1.account });
      await healthPassport.write.mintPassport([
        mockUserData.dataURI,
        mockUserData.dataHash,
        mockUserData.encryptedUserData,
        proofs,
        categories,
        values
      ], { account: user1.account });

      // Mint second passport
      await mockUSDT.write.approve([healthPassport.address, passportFee], { account: user1.account });
      await healthPassport.write.mintPassport([
        "ipfs://QmSecondPassport",
        "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        mockUserData.encryptedUserData,
        proofs,
        categories,
        values
      ], { account: user1.account });

      // Check user owns both tokens
      const balance = await healthPassport.read.balanceOf([user1.account.address]);
      assert.equal(balance, 2n);

      const owner1 = await healthPassport.read.ownerOf([1n]);
      const owner2 = await healthPassport.read.ownerOf([2n]);
      
      assert.equal(owner1.toLowerCase(), user1.account.address.toLowerCase());
      assert.equal(owner2.toLowerCase(), user1.account.address.toLowerCase());
    });

    it("Should handle verification of non-existent passport", async function () {
      try {
        await healthPassport.write.verify([999n, true, "ipfs://approval"], { account: verifier.account });
        assert.fail("Should have thrown an error");
      } catch (error: any) {
        assert.ok(error.message.includes("ERC721NonexistentToken") || error.message.includes("token"));
      }
    });

    it("Should handle empty data URI", async function () {
      const proofs = [createMockProof(true)];
      const categories = [0];
      const values = [1990];

      await mockUSDT.write.approve([healthPassport.address, passportFee], { account: user1.account });
      
      await healthPassport.write.mintPassport([
        "", // Empty URI
        mockUserData.dataHash,
        mockUserData.encryptedUserData,
        proofs,
        categories,
        values
      ], { account: user1.account });

      const tokenId = 1n;
      const passportData = await healthPassport.read.passportOf([tokenId]);
      assert.equal(passportData[1], ""); // dataURI is empty (index 1)
    });
  });
});