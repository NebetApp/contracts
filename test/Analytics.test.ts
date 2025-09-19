import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { network } from "hardhat";

describe("Analytics", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [admin, relayer, purchaser] = await viem.getWalletClients();

  let analytics: any;
  let mockUSDT: any;
  let accessManager: any;
  let zkpVerifier: any;

  const price = 1_000n * 10n ** 6n;

  beforeEach(async function () {
    accessManager = await viem.deployContract("AccessManager", [admin.account.address]);
    zkpVerifier = await viem.deployContract("ZKPVerifier", [admin.account.address, relayer.account.address]);
    mockUSDT = await viem.deployContract("MockERC20", ["USDT", "USDT", 6]);
    analytics = await viem.deployContract("Analytics", [accessManager.address, zkpVerifier.address, mockUSDT.address]);

    await analytics.write.setHealthPassport([admin.account.address], { account: admin.account });

    await mockUSDT.write.mint([purchaser.account.address, price * 10n]);
    await mockUSDT.write.approve([analytics.address, price * 10n], { account: purchaser.account });
  });

  it("tracks passport metrics", async function () {
    await analytics.write.updatePassportMetrics([5n, 3n, price]);
    const metrics = await analytics.read.getGlobalMetrics();
    assert.equal(metrics[0], 5n);
    assert.equal(metrics[1], 3n);
    assert.equal(metrics[2], price);
  });

  it("records verified demographics", async function () {
    await analytics.write.recordVerifiedDemographic([0, 1990n, 2n], { account: admin.account });
    const count = await analytics.read.getVerifiedDemographicCount([0, 1990n]);
    assert.equal(count, 2n);

    const batch = await analytics.read.getVerifiedDemographicBatch([[0, 1], [1990n, 5n]]);
    assert.equal(batch[0], 2n);
    assert.equal(batch[1], 0n);
  });

  it("creates analytics packages", async function () {
    await analytics.write.createAnalyticsPackage([
      "Package",
      "Description",
      price,
      [0n, 1n]
    ]);

    const pkg = await analytics.read.analyticsPackages([1n]);
    assert.equal(pkg[0], "Package");
    assert.equal(pkg[3], true);
  });

  it("processes purchases", async function () {
    await analytics.write.createAnalyticsPackage(["Premium", "desc", price, [0n]], { account: admin.account });

    const buyerBalanceBefore = await mockUSDT.read.balanceOf([purchaser.account.address]);
    await analytics.write.purchaseAnalytics([1n], { account: purchaser.account });
    const buyerBalanceAfter = await mockUSDT.read.balanceOf([purchaser.account.address]);
    assert.equal(buyerBalanceBefore - buyerBalanceAfter, price);
  });

  it("allows admin to withdraw fees", async function () {
    await analytics.write.createAnalyticsPackage(["Premium", "desc", price, [0n]], { account: admin.account });
    await analytics.write.purchaseAnalytics([1n], { account: purchaser.account });

    const before = await mockUSDT.read.balanceOf([admin.account.address]);
    await analytics.write.withdrawFees([admin.account.address, price], { account: admin.account });
    const after = await mockUSDT.read.balanceOf([admin.account.address]);
    assert.equal(after - before, price);
  });
});
