import { writeFile } from "node:fs/promises";
import path from "node:path";
import hre from "hardhat";
import type { ConstructorArgs } from "@nomicfoundation/hardhat-viem/types";
import type { Address } from "viem";
import { Hex, parseUnits } from "viem";

function envAddress(name: string, fallback: Address): Address {
  const value = process.env[name];
  if (!value) return fallback;
  return value as Address;
}

async function main() {
  const connection = await hre.network.connect();
  const { networkName, viem } = connection;

  if (networkName !== "baseSepolia") {
    console.warn(`⚠️  You are running on "${networkName}". Set --network baseSepolia for production deployment.`);
  }
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

  function extractStatusCode(error: unknown): number | undefined {
    const visited = new Set<unknown>();
    const queue: unknown[] = [error];

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined || current === null || visited.has(current)) {
        continue;
      }

      visited.add(current);

      if (
        typeof current === "object" &&
        "statusCode" in current &&
        typeof (current as { statusCode: unknown }).statusCode === "number"
      ) {
        return (current as { statusCode: number }).statusCode;
      }

      if (typeof current === "object" && "cause" in current) {
        queue.push((current as { cause?: unknown }).cause);
      }
    }

    return undefined;
  }

  async function runWith403Guard<T>(
    action: () => Promise<T>,
    message: string
  ): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (extractStatusCode(error) === 403) {
        throw new Error(
          `${message} Provide an authenticated Base Sepolia RPC URL in BASE_SEPOLIA_RPC_URL (Alchemy, QuickNode, etc.).`,
          { cause: error }
        );
      }
      throw error;
    }
  }

  async function deployContractWithReceipt<ContractName extends string>(
    contractName: ContractName,
    constructorArgs?: ConstructorArgs<ContractName>
  ) {
    const artifact = await hre.artifacts.readArtifact(contractName);

    const deploymentTxHash = await runWith403Guard(
      async () =>
        (await deployer.deployContract({
          abi: artifact.abi,
          bytecode: artifact.bytecode as Hex,
          args: constructorArgs ?? [],
          account: deployer.account,
          chain: deployer.chain
        })) as Hex,
      `Broadcast rejected by RPC (HTTP 403) while deploying ${contractName}.`
    );

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: deploymentTxHash,
      confirmations: 1,
      retryCount: 30,
      retryDelay: 2_000
    });

    if (!receipt.contractAddress) {
      throw new Error(`Failed to deploy ${contractName}: missing contract address in receipt`);
    }

    const contract = await viem.getContractAt(contractName, receipt.contractAddress, {
      client: {
        public: publicClient,
        wallet: deployer
      }
    });

    return {
      contract,
      receipt
    };
  }

  const mockUsdtDeployment = await deployContractWithReceipt("MockERC20", ["Mock USDT", "mUSDT", 6]);
  const accessManagerDeployment = await deployContractWithReceipt("AccessManager", [adminAddress]);
  const zkpVerifierDeployment = await deployContractWithReceipt("ZKPVerifier", [adminAddress, relayerAddress]);
  const analyticsDeployment = await deployContractWithReceipt("Analytics", [accessManagerDeployment.contract.address, zkpVerifierDeployment.contract.address, mockUsdtDeployment.contract.address]);
  const healthPassportDeployment = await deployContractWithReceipt("HealthPassport", [accessManagerDeployment.contract.address, mockUsdtDeployment.contract.address, analyticsDeployment.contract.address, zkpVerifierDeployment.contract.address]);
  const treatmentImplementationDeployment = await deployContractWithReceipt("TreatmentCampaign");
  const fundingHubDeployment = await deployContractWithReceipt("FundingHub", [accessManagerDeployment.contract.address, healthPassportDeployment.contract.address, treatmentImplementationDeployment.contract.address, adminAddress]);

  const mockUsdt = mockUsdtDeployment.contract;
  const accessManager = accessManagerDeployment.contract;
  const zkpVerifier = zkpVerifierDeployment.contract;
  const analytics = analyticsDeployment.contract;
  const healthPassport = healthPassportDeployment.contract;
  const treatmentImplementation = treatmentImplementationDeployment.contract;
  const fundingHub = fundingHubDeployment.contract;

  const deploymentReceipts = {
    accessManager: accessManagerDeployment.receipt,
    zkpVerifier: zkpVerifierDeployment.receipt,
    analytics: analyticsDeployment.receipt,
    healthPassport: healthPassportDeployment.receipt,
    treatmentImplementation: treatmentImplementationDeployment.receipt,
    fundingHub: fundingHubDeployment.receipt,
    mockUsdt: mockUsdtDeployment.receipt
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
    await runWith403Guard(
      () => mockUsdt.write.mint([recipient, parseUnits("100000", 6)], { account: deployer.account }),
      "Broadcast rejected by RPC (HTTP 403) while minting mock USDT."
    );
  }

  if (adminAddress.toLowerCase() === deployer.account.address.toLowerCase()) {
    await runWith403Guard(
      () => accessManager.write.addVerifier([verifierAddress, "Verifier", "https://example.com"], { account: deployer.account }),
      "Broadcast rejected by RPC (HTTP 403) while adding the verifier."
    );
  } else {
    console.warn("Skipped accessManager.addVerifier – call from the admin wallet.");
  }

  const summary = {
    network: networkName,
    deployer: deployer.account.address,
    admin: adminAddress,
    relayer: relayerAddress,
    verifier: verifierAddress,
    patient: patientAddress,
    donor: donorAddress,
    blocks: {
      mockUsdt: deploymentReceipts.mockUsdt.blockNumber.toString(),
      accessManager: deploymentReceipts.accessManager.blockNumber.toString(),
      zkpVerifier: deploymentReceipts.zkpVerifier.blockNumber.toString(),
      analytics: deploymentReceipts.analytics.blockNumber.toString(),
      healthPassport: deploymentReceipts.healthPassport.blockNumber.toString(),
      treatmentImplementation: deploymentReceipts.treatmentImplementation.blockNumber.toString(),
      fundingHub: deploymentReceipts.fundingHub.blockNumber.toString()
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
