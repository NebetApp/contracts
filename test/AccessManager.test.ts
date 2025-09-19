import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { network } from "hardhat";
import { Address, parseEther } from "viem";

describe("AccessManager", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [admin, verifier1, verifier2, user] = await viem.getWalletClients();

  let accessManager: any;

  beforeEach(async function () {
    // Deploy fresh AccessManager for each test
    accessManager = await viem.deployContract("AccessManager", [admin.account.address]);
  });

  describe("Deployment", function () {
    it("Should set the deployer as admin", async function () {
      const adminRole = await accessManager.read.DEFAULT_ADMIN_ROLE();
      const hasRole = await accessManager.read.hasRole([adminRole, admin.account.address]);
      assert.equal(hasRole, true);
    });

    it("Should have correct role constants", async function () {
      const verifierRole = await accessManager.read.VERIFIER_ROLE();
      const pauserRole = await accessManager.read.PAUSER_ROLE();
      
      assert.equal(typeof verifierRole, "string");
      assert.equal(typeof pauserRole, "string");
    });
  });

  describe("Verifier Management", function () {
    it("Should allow admin to add verifier", async function () {
      const verifierName = "Test Clinic";
      const verifierURI = "https://test-clinic.com";

      // Just check that the transaction succeeds and state is updated
      await accessManager.write.addVerifier([verifier1.account.address, verifierName, verifierURI]);

      const hasRole = await accessManager.read.isVerifier([verifier1.account.address]);
      assert.equal(hasRole, true);

      const verifierInfo = await accessManager.read.verifierInfo([verifier1.account.address]);
      assert.equal(verifierInfo.active, true);
      assert.equal(verifierInfo.name, verifierName);
      assert.equal(verifierInfo.uri, verifierURI);
    });

    it("Should not allow non-admin to add verifier", async function () {
      try {
        await accessManager.write.addVerifier(
          [verifier1.account.address, "Test Clinic", "https://test.com"],
          { account: verifier1.account }
        );
        assert.fail("Should have thrown an error");
      } catch (error: any) {
        assert.ok(error.message.includes("AccessControl"));
      }
    });

    it("Should allow admin to remove verifier", async function () {
      // First add a verifier
      await accessManager.write.addVerifier([verifier1.account.address, "Test Clinic", "https://test.com"]);

      // Then remove it
      await accessManager.write.removeVerifier([verifier1.account.address]);

      const hasRole = await accessManager.read.isVerifier([verifier1.account.address]);
      assert.equal(hasRole, false);

      const verifierInfo = await accessManager.read.verifierInfo([verifier1.account.address]);
      assert.equal(verifierInfo.active, false);
    });

    it("Should handle multiple verifiers", async function () {
      // Add multiple verifiers
      await accessManager.write.addVerifier([verifier1.account.address, "Clinic 1", "https://clinic1.com"]);
      await accessManager.write.addVerifier([verifier2.account.address, "Clinic 2", "https://clinic2.com"]);

      // Check both are verifiers
      const isVerifier1 = await accessManager.read.isVerifier([verifier1.account.address]);
      const isVerifier2 = await accessManager.read.isVerifier([verifier2.account.address]);
      
      assert.equal(isVerifier1, true);
      assert.equal(isVerifier2, true);

      // Remove one
      await accessManager.write.removeVerifier([verifier1.account.address]);

      // Check states
      const stillVerifier1 = await accessManager.read.isVerifier([verifier1.account.address]);
      const stillVerifier2 = await accessManager.read.isVerifier([verifier2.account.address]);
      
      assert.equal(stillVerifier1, false);
      assert.equal(stillVerifier2, true);
    });
  });

  describe("Role Management", function () {
    it("Should check verifier role correctly", async function () {
      // Initially not a verifier
      const initialCheck = await accessManager.read.isVerifier([user.account.address]);
      assert.equal(initialCheck, false);

      // Add as verifier
      await accessManager.write.addVerifier([user.account.address, "User Clinic", "https://user.com"]);

      // Should now be verifier
      const finalCheck = await accessManager.read.isVerifier([user.account.address]);
      assert.equal(finalCheck, true);
    });

    it("Should return correct verifier info", async function () {
      const name = "Test Medical Center";
      const uri = "https://testmedical.org";

      await accessManager.write.addVerifier([verifier1.account.address, name, uri]);

      const info = await accessManager.read.verifierInfo([verifier1.account.address]);
      assert.equal(info.active, true);
      assert.equal(info.name, name);
      assert.equal(info.uri, uri);
    });

    it("Should return empty info for non-verifiers", async function () {
      const info = await accessManager.read.verifierInfo([user.account.address]);
      assert.equal(info.active, false);
      assert.equal(info.name, "");
      assert.equal(info.uri, "");
    });
  });

  describe("Access Control Integration", function () {
    it("Should work with OpenZeppelin AccessControl", async function () {
      const adminRole = await accessManager.read.DEFAULT_ADMIN_ROLE();
      const verifierRole = await accessManager.read.VERIFIER_ROLE();

      // Admin should have admin role
      const adminHasAdminRole = await accessManager.read.hasRole([adminRole, admin.account.address]);
      assert.equal(adminHasAdminRole, true);

      // Add verifier and check role
      await accessManager.write.addVerifier([verifier1.account.address, "Test", "https://test.com"]);
      const verifierHasRole = await accessManager.read.hasRole([verifierRole, verifier1.account.address]);
      assert.equal(verifierHasRole, true);

      // Non-verifier should not have role
      const userHasRole = await accessManager.read.hasRole([verifierRole, user.account.address]);
      assert.equal(userHasRole, false);
    });
  });
});