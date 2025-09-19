import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { network } from "hardhat";
import { Address, parseUnits } from "viem";

describe("TreatmentCampaign", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer, beneficiary, donor1, donor2, hub] = await viem.getWalletClients();

  let treatmentCampaign: any;
  let fundingToken: any;

  // Test parameters
  const goalAmount = parseUnits("1000", 18); // 1000 tokens
  const pledgeAmount1 = parseUnits("300", 18); // 300 tokens
  const pledgeAmount2 = parseUnits("400", 18); // 400 tokens
  const futureDeadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now

  beforeEach(async function () {
    // Deploy funding token
    fundingToken = await viem.deployContract("MockERC20", [
      "Funding Token",
      "FUND",
      18
    ]);

    // Deploy treatment campaign
    treatmentCampaign = await viem.deployContract("TreatmentCampaign");

    // Initialize the campaign
    await treatmentCampaign.write.initialize([
      hub.account.address,
      fundingToken.address,
      beneficiary.account.address,
      beneficiary.account.address, // payout address same as beneficiary
      goalAmount,
      futureDeadline
    ]);

    // Mint tokens for donors
    await fundingToken.write.mint([donor1.account.address, pledgeAmount1 * 2n]);
    await fundingToken.write.mint([donor2.account.address, pledgeAmount2 * 2n]);

    // Approve campaign to spend tokens
    await fundingToken.write.approve([treatmentCampaign.address, pledgeAmount1], { account: donor1.account });
    await fundingToken.write.approve([treatmentCampaign.address, pledgeAmount2], { account: donor2.account });
  });

  describe("Initialization", function () {
    it("Should initialize with correct parameters", async function () {
      const hubAddr = await treatmentCampaign.read.hub();
      const tokenAddr = await treatmentCampaign.read.token();
      const beneficiaryAddr = await treatmentCampaign.read.beneficiary();
      const payoutAddr = await treatmentCampaign.read.payout();
      const goal = await treatmentCampaign.read.goal();
      const deadline = await treatmentCampaign.read.deadline();
      const state = await treatmentCampaign.read.state();

      assert.equal(hubAddr.toLowerCase(), hub.account.address.toLowerCase());
      assert.equal(tokenAddr.toLowerCase(), fundingToken.address.toLowerCase());
      assert.equal(beneficiaryAddr.toLowerCase(), beneficiary.account.address.toLowerCase());
      assert.equal(payoutAddr.toLowerCase(), beneficiary.account.address.toLowerCase());
      assert.equal(goal, goalAmount);
      assert.equal(deadline, futureDeadline);
      assert.equal(state, 0); // Active
    });

    it("Should start with zero total pledged", async function () {
      const totalPledged = await treatmentCampaign.read.totalPledged();
      assert.equal(totalPledged, 0n);
    });

    it("Should not allow double initialization", async function () {
      await assert.rejects(
        async () => {
          await treatmentCampaign.write.initialize([
            hub.account.address,
            fundingToken.address,
            beneficiary.account.address,
            beneficiary.account.address,
            goalAmount,
            futureDeadline
          ]);
        }
      );
    });
  });

  describe("Pledging", function () {
    it("Should allow users to pledge tokens", async function () {
      await treatmentCampaign.write.pledge([pledgeAmount1], { account: donor1.account });

      const totalPledged = await treatmentCampaign.read.totalPledged();
      const userPledge = await treatmentCampaign.read.pledges([donor1.account.address]);

      assert.equal(totalPledged, pledgeAmount1);
      assert.equal(userPledge, pledgeAmount1);
    });

    it("Should allow multiple pledges from same user", async function () {
      const initialPledge = parseUnits("100", 18);
      const additionalPledge = parseUnits("200", 18);

      // First pledge
      await fundingToken.write.approve([treatmentCampaign.address, initialPledge], { account: donor1.account });
      await treatmentCampaign.write.pledge([initialPledge], { account: donor1.account });

      // Second pledge
      await fundingToken.write.approve([treatmentCampaign.address, additionalPledge], { account: donor1.account });
      await treatmentCampaign.write.pledge([additionalPledge], { account: donor1.account });

      const totalPledged = await treatmentCampaign.read.totalPledged();
      const userPledge = await treatmentCampaign.read.pledges([donor1.account.address]);

      assert.equal(totalPledged, initialPledge + additionalPledge);
      assert.equal(userPledge, initialPledge + additionalPledge);
    });

    it("Should allow multiple users to pledge", async function () {
      await treatmentCampaign.write.pledge([pledgeAmount1], { account: donor1.account });
      await treatmentCampaign.write.pledge([pledgeAmount2], { account: donor2.account });

      const totalPledged = await treatmentCampaign.read.totalPledged();
      const userPledge1 = await treatmentCampaign.read.pledges([donor1.account.address]);
      const userPledge2 = await treatmentCampaign.read.pledges([donor2.account.address]);

      assert.equal(totalPledged, pledgeAmount1 + pledgeAmount2);
      assert.equal(userPledge1, pledgeAmount1);
      assert.equal(userPledge2, pledgeAmount2);
    });

    it("Should emit Pledged event", async function () {
      const hash = await treatmentCampaign.write.pledge([pledgeAmount1], { account: donor1.account });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const events = await publicClient.getContractEvents({
        address: treatmentCampaign.address,
        abi: treatmentCampaign.abi,
        eventName: "Pledged",
        fromBlock: receipt.blockNumber,
        toBlock: receipt.blockNumber
      });

      assert.equal(events.length, 1);
    });
  });

  describe("Unpledging", function () {
    beforeEach(async function () {
      // Make some pledges first
      await treatmentCampaign.write.pledge([pledgeAmount1], { account: donor1.account });
      await treatmentCampaign.write.pledge([pledgeAmount2], { account: donor2.account });
    });

    it("Should allow users to unpledge tokens", async function () {
      const unpledgeAmount = parseUnits("100", 18);
      
      await treatmentCampaign.write.unpledge([unpledgeAmount], { account: donor1.account });

      const totalPledged = await treatmentCampaign.read.totalPledged();
      const userPledge = await treatmentCampaign.read.pledges([donor1.account.address]);

      assert.equal(totalPledged, pledgeAmount1 + pledgeAmount2 - unpledgeAmount);
      assert.equal(userPledge, pledgeAmount1 - unpledgeAmount);
    });

    it("Should not allow unpledging more than pledged", async function () {
      const excessiveAmount = pledgeAmount1 + parseUnits("1", 18);

      await assert.rejects(
        async () => {
          await treatmentCampaign.write.unpledge([excessiveAmount], { account: donor1.account });
        }
      );
    });

    it("Should emit Unpledged event", async function () {
      const unpledgeAmount = parseUnits("100", 18);
      
      const hash = await treatmentCampaign.write.unpledge([unpledgeAmount], { account: donor1.account });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const events = await publicClient.getContractEvents({
        address: treatmentCampaign.address,
        abi: treatmentCampaign.abi,
        eventName: "Unpledged",
        fromBlock: receipt.blockNumber,
        toBlock: receipt.blockNumber
      });

      assert.equal(events.length, 1);
    });
  });

  describe("Basic Functionality", function () {
    it("Should track campaign state correctly", async function () {
      // Initial state
      let state = await treatmentCampaign.read.state();
      assert.equal(state, 0); // Active

      // After pledging
      await treatmentCampaign.write.pledge([pledgeAmount1], { account: donor1.account });
      const totalPledged = await treatmentCampaign.read.totalPledged();
      assert.equal(totalPledged, pledgeAmount1);

      // Check pledge mapping
      const userPledge = await treatmentCampaign.read.pledges([donor1.account.address]);
      assert.equal(userPledge, pledgeAmount1);
    });

    it("Should handle multiple donors correctly", async function () {
      await treatmentCampaign.write.pledge([pledgeAmount1], { account: donor1.account });
      await treatmentCampaign.write.pledge([pledgeAmount2], { account: donor2.account });

      const totalPledged = await treatmentCampaign.read.totalPledged();
      const donor1Pledge = await treatmentCampaign.read.pledges([donor1.account.address]);
      const donor2Pledge = await treatmentCampaign.read.pledges([donor2.account.address]);

      assert.equal(totalPledged, pledgeAmount1 + pledgeAmount2);
      assert.equal(donor1Pledge, pledgeAmount1);
      assert.equal(donor2Pledge, pledgeAmount2);
    });

    it("Should not allow pledging zero amount", async function () {
      await assert.rejects(
        async () => {
          await treatmentCampaign.write.pledge([0n], { account: donor1.account });
        }
      );
    });

    it("Should not allow unpledging zero amount", async function () {
      await treatmentCampaign.write.pledge([pledgeAmount1], { account: donor1.account });

      await assert.rejects(
        async () => {
          await treatmentCampaign.write.unpledge([0n], { account: donor1.account });
        }
      );
    });
  });
});