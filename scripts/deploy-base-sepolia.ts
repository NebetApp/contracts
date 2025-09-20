import { writeFile } from "node:fs/promises";
import path from "node:path";
import hre from "hardhat";
import type { Address } from "viem";
import { parseUnits } from "viem";

function envAddress(name: string, fallback: Address): Address {
  const value = process.env[name];
  if (!value) return fallback;
  return value as Address;
}

async function main() {
  if (hre.network.name !== "baseSepolia") {
    console.warn(`⚠️  You are running on "${hre.network.name}". Set --network baseSepolia for production deployment.`);
  }

  const connection = await hre.network.connect();
  const { viem } = connection;
  const publicClient = await viem.getPublicClient();
  const [deployer] = await viem.getWalletClients();

  const adminAddress = envAddress("BASE_ADMIN_ADDRESS", deployer.account.address as Address);
  const relayerAddress = envAddress("BASE_RELAYER_ADDRESS", adminAddress);
  const verifierAddress = envAddress("BASE_VERIFIER_ADDRESS", adminAddress);
  const patientAddress = envAddress("BASE_PATIENT_ADDRESS", deployer.account.address as Address);
  const donorAddress = envAddress("BASE_DONOR_ADDRESS", deployer.account.address as Address);

  console.log("Deploying contracts with", deployer.account.address);
  console.log("Admin:", adminAddress);
  console.log("Relayer:", relayerAddress);
  console.log("Verifier:", verifierAddress);

  const mockUsdt = await viem.deployContract("MockERC20", ["Mock USDT", "mUSDT", 6]);
  const accessManager = await viem.deployContract("AccessManager", [adminAddress]);
  const zkpVerifier = await viem.deployContract("ZKPVerifier", [adminAddress, relayerAddress]);
  const analytics = await viem.deployContract("Analytics", [accessManager.address, zkpVerifier.address, mockUsdt.address]);
  const healthPassport = await viem.deployContract("HealthPassport", [accessManager.address, mockUsdt.address, analytics.address, zkpVerifier.address]);
  const treatmentImplementation = await viem.deployContract("TreatmentCampaign");
  const fundingHub = await viem.deployContract("FundingHub", [accessManager.address, healthPassport.address, treatmentImplementation.address, adminAddress]);

  const deploymentReceipts = {
    accessManager: await publicClient.waitForTransactionReceipt({ hash: accessManager.deploymentTransactionHash as `0x${string}` }),
    zkpVerifier: await publicClient.waitForTransactionReceipt({ hash: zkpVerifier.deploymentTransactionHash as `0x${string}` }),
    analytics: await publicClient.waitForTransactionReceipt({ hash: analytics.deploymentTransactionHash as `0x${string}` }),
    healthPassport: await publicClient.waitForTransactionReceipt({ hash: healthPassport.deploymentTransactionHash as `0x${string}` }),
    treatmentImplementation: await publicClient.waitForTransactionReceipt({ hash: treatmentImplementation.deploymentTransactionHash as `0x${string}` }),
    fundingHub: await publicClient.waitForTransactionReceipt({ hash: fundingHub.deploymentTransactionHash as `0x${string}` }),
    mockUsdt: await publicClient.waitForTransactionReceipt({ hash: mockUsdt.deploymentTransactionHash as `0x${string}` })
  };

  if (adminAddress.toLowerCase() === deployer.account.address.toLowerCase()) {
    await analytics.write.setHealthPassport([healthPassport.address], { account: deployer.account });
  } else {
    console.warn("Skipped analytics.setHealthPassport – run from the admin account once deployed.");
  }

  if (verifierAddress !== adminAddress && verifierAddress !== deployer.account.address) {
    console.warn("Remember to grant VERIFIER_ROLE to", verifierAddress, "after deployment.");
  }

  const mintRecipients = [
    deployer.account.address as Address,
    adminAddress,
    relayerAddress,
    verifierAddress,
    patientAddress,
    donorAddress
  ];

  for (const recipient of mintRecipients) {
    await mockUsdt.write.mint([recipient, parseUnits("100000", 6)], { account: deployer.account });
  }

  if (adminAddress.toLowerCase() === deployer.account.address.toLowerCase()) {
    await accessManager.write.addVerifier([verifierAddress, "Verifier", "https://example.com"], { account: deployer.account });
  } else {
    console.warn("Skipped accessManager.addVerifier – call from the admin wallet.");
  }

  const networkName = hre.network.name;
  const summary = {
    network: networkName,
    deployer: deployer.account.address,
    admin: adminAddress,
    relayer: relayerAddress,
    verifier: verifierAddress,
    patient: patientAddress,
    donor: donorAddress,
    blocks: {
      mockUsdt: deploymentReceipts.mockUsdt.blockNumber,
      accessManager: deploymentReceipts.accessManager.blockNumber,
      zkpVerifier: deploymentReceipts.zkpVerifier.blockNumber,
      analytics: deploymentReceipts.analytics.blockNumber,
      healthPassport: deploymentReceipts.healthPassport.blockNumber,
      treatmentImplementation: deploymentReceipts.treatmentImplementation.blockNumber,
      fundingHub: deploymentReceipts.fundingHub.blockNumber
    },
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
