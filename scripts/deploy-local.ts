import { writeFile } from "node:fs/promises";
import path from "node:path";
import hre from "hardhat";
import { parseUnits } from "viem";

async function main() {
  const connection = await hre.network.connect();
  const { viem } = connection;
  const publicClient = await viem.getPublicClient();
  const [deployer, admin, verifier, donor] = await viem.getWalletClients();

  console.log("Deploying contracts with", deployer.account.address);

  const mockUsdt = await viem.deployContract("MockERC20", ["Mock USDT", "mUSDT", 6]);
  const accessManager = await viem.deployContract("AccessManager", [deployer.account.address]);
  const zkpVerifier = await viem.deployContract("ZKPVerifier", [deployer.account.address, deployer.account.address]);
  const analytics = await viem.deployContract("Analytics", [accessManager.address, zkpVerifier.address, mockUsdt.address]);
  const healthPassport = await viem.deployContract("HealthPassport", [accessManager.address, mockUsdt.address, analytics.address, zkpVerifier.address]);
  await analytics.write.setHealthPassport([healthPassport.address], { account: deployer.account });
  const treatmentImplementation = await viem.deployContract("TreatmentCampaign");
  const fundingHub = await viem.deployContract("FundingHub", [accessManager.address, healthPassport.address, treatmentImplementation.address, deployer.account.address]);

  console.log("AccessManager:", accessManager.address);
  console.log("HealthPassport:", healthPassport.address);
  console.log("FundingHub:", fundingHub.address);
  console.log("MockUSDT:", mockUsdt.address);
  console.log("ZKPVerifier:", zkpVerifier.address);
  console.log("Analytics:", analytics.address);
  console.log("Treatment implementation:", treatmentImplementation.address);

  // Seed roles and token balances for manual testing.
  await mockUsdt.write.mint([deployer.account.address, parseUnits("1000000", 6)]);
  await mockUsdt.write.mint([admin.account.address, parseUnits("1000000", 6)]);
  await mockUsdt.write.mint([verifier.account.address, parseUnits("1000000", 6)]);
  await mockUsdt.write.mint([donor.account.address, parseUnits("1000000", 6)]);

  await accessManager.write.addVerifier([verifier.account.address, "Verifier One", "https://verifier.local"]);

  const networkName = hre.network.name;

  const summary = {
    network: networkName,
    deployer: deployer.account.address,
    admin: admin.account.address,
    verifier: verifier.account.address,
    donor: donor.account.address,
    contracts: {
      accessManager: accessManager.address,
      analytics: analytics.address,
      fundingHub: fundingHub.address,
      healthPassport: healthPassport.address,
      mockUsdt: mockUsdt.address,
      treatmentImplementation: treatmentImplementation.address,
      zkpVerifier: zkpVerifier.address
    }
  } as const;

  const outputPath = path.join(hre.config.paths.root, "deployments", `${networkName}-latest.json`);
  await writeFile(outputPath, JSON.stringify(summary, null, 2), "utf8");
  console.log(`\nDeployment summary saved to ${outputPath}`);

  const gas = await publicClient.getGasPrice();
  console.log("Current gas price:", gas.toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
