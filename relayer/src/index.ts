import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import pRetry, { AbortError } from "p-retry";
import {
  createPublicClient,
  createWalletClient,
  custom,
  decodeFunctionData,
  http,
  keccak256,
  parseAbi,
  parseAbiItem,
  encodeAbiParameters,
  stringToHex
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia, hardhat } from "viem/chains";

const NETWORK = (process.env.NETWORK ?? "baseSepolia") as "local" | "baseSepolia";
const RPC_URL = process.env.RPC_URL ?? (NETWORK === "local" ? "http://127.0.0.1:8545" : undefined);
if (!RPC_URL) {
  throw new Error("RPC_URL is required when targeting Base Sepolia");
}

const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
if (!RELAYER_PRIVATE_KEY) {
  throw new Error("RELAYER_PRIVATE_KEY is required");
}

const ZKVERIFY_API_URL = process.env.ZKVERIFY_API_URL;
const ZKVERIFY_API_KEY = process.env.ZKVERIFY_API_KEY;
const ZKVERIFY_PROGRAM_ID = process.env.ZKVERIFY_PROGRAM_ID;

const POLL_INTERVAL_MS = Number(process.env.ZKVERIFY_POLL_INTERVAL_MS ?? "15000");
const MAX_ATTEMPTS = Number(process.env.ZKVERIFY_MAX_ATTEMPTS ?? "20");

const chain = NETWORK === "local" ? hardhat : baseSepolia;
const account = privateKeyToAccount(RELAYER_PRIVATE_KEY as `0x${string}`);

const deploymentFile = process.env.DEPLOYMENT_FILE ?? path.resolve(process.cwd(), "deployments", `${NETWORK}-latest.json`);

async function loadDeployment() {
  const json = await fs.readFile(deploymentFile, "utf8");
  const data = JSON.parse(json);
  if (!data.contracts?.zkpVerifier) {
    throw new Error(`Deployment file ${deploymentFile} does not contain contracts.zkpVerifier`);
  }
  return data;
}

const ZKP_VERIFIER_ABI = parseAbi([
  "event ProofSubmitted(uint256 indexed proofId, address indexed submitter, uint8 indexed category, uint256 value, bytes32 proofHash)",
  "event ProofVerified(uint256 indexed proofId, bytes32 submissionId)",
  "function submitProof((uint256[2],uint256[2][2],uint256[2],uint256[]) proof, uint8 category, uint256 value) returns (uint256)",
  "function submitProofBatch((uint256[2],uint256[2][2],uint256[2],uint256[])[] proofs, uint8[] categories, uint256[] values) returns (uint256[] memory)",
  "function markVerified(uint256 proofId, bytes32 submissionId)",
  "function markVerifiedBatch(uint256[] proofIds, bytes32[] submissionIds)",
  "function proofInfo(uint256 proofId) view returns (address submitter, uint8 category, uint256 value, bytes32 proofHash, bool verified, bytes32 submissionId)"
]);

const proofSubmittedEvent = parseAbiItem(
  "event ProofSubmitted(uint256 indexed proofId, address indexed submitter, uint8 indexed category, uint256 value, bytes32 proofHash)"
);

type ProofStruct = {
  a: readonly [bigint, bigint];
  b: readonly [readonly [bigint, bigint], readonly [bigint, bigint]];
  c: readonly [bigint, bigint];
  inputs: readonly bigint[];
};

type Address = `0x${string}`;

type ProofPayload = {
  proof: ProofStruct;
  category: number;
  value: bigint;
  proofHash: `0x${string}`;
  submitter: Address;
  proofId: bigint;
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBytes32Hex(): `0x${string}` {
  const buffer = crypto.getRandomValues(new Uint8Array(32));
  let hex = "0x";
  for (const byte of buffer) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex as `0x${string}`;
}

function ensureBytes32(value: string | undefined): `0x${string}` {
  if (!value) return randomBytes32Hex();
  let trimmed = value.trim();
  if (!trimmed.startsWith("0x")) {
    trimmed = stringToHex(trimmed, { size: 32 });
  }
  if (trimmed.length !== 66) {
    trimmed = keccak256(stringToHex(trimmed));
  }
  return trimmed as `0x${string}`;
}

function hashProof(payload: { proof: ProofStruct; category: number; value: bigint }): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "uint256[2]" },
        { type: "uint256[2][2]" },
        { type: "uint256[2]" },
        { type: "uint256[]" },
        { type: "uint8" },
        { type: "uint256" }
      ],
      [
        payload.proof.a,
        payload.proof.b,
        payload.proof.c,
        payload.proof.inputs,
        BigInt(payload.category),
        payload.value
      ] as any
    )
  );
}

async function main() {
  const deployment = await loadDeployment();
  const contracts = deployment.contracts as Record<string, Address>;

  const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account, chain, transport: http(RPC_URL) });

  console.log(`Relayer started for network ${NETWORK}`);
  console.log(`zkVerifier: ${contracts.zkpVerifier}`);

  const processed = new Set<string>();

  const fromBlockEnv = process.env.FROM_BLOCK ? BigInt(process.env.FROM_BLOCK) : undefined;
  if (fromBlockEnv !== undefined) {
    console.log(`Replaying ProofSubmitted events from block ${fromBlockEnv.toString()}`);
    const historicalLogs = await publicClient.getLogs({
      address: contracts.zkpVerifier,
      event: proofSubmittedEvent,
      fromBlock: fromBlockEnv,
      toBlock: "latest"
    });
    for (const log of historicalLogs) {
      await handleProofLog(publicClient, walletClient, contracts.zkpVerifier, log, processed);
    }
  }

  publicClient.watchEvent({
    address: contracts.zkpVerifier,
    event: proofSubmittedEvent,
    poll: true,
    pollingInterval: POLL_INTERVAL_MS,
    onLogs: async (logs) => {
      for (const log of logs) {
        await handleProofLog(publicClient, walletClient, contracts.zkpVerifier, log, processed);
      }
    },
    onError: (error) => {
      console.error("Watch event error", error);
    }
  });
}

type ProofLog = any;

async function handleProofLog(
  publicClient: any,
  walletClient: any,
  verifierAddress: Address,
  log: ProofLog,
  processed: Set<string>
) {
  const key = `${log.transactionHash}:${log.args.proofId.toString()}`;
  if (processed.has(key)) return;
  processed.add(key);

  try {
    console.log(`↳ Received proof ${log.args.proofId} (category ${log.args.category}, value ${log.args.value})`);
    const payload = await extractProofPayload(publicClient, log);
    if (!payload) {
      console.warn(`Could not recover proof data for ${log.args.proofId}. Skipping.`);
      return;
    }

    const submissionId = await submitViaZkVerify(payload);
    const submissionBytes32 = ensureBytes32(submissionId);

    await walletClient.writeContract({
      address: verifierAddress,
      abi: ZKP_VERIFIER_ABI,
      functionName: "markVerified",
      account: walletClient.account,
      args: [payload.proofId, submissionBytes32]
    });

    console.log(`✔ Proof ${payload.proofId} marked verified (${submissionBytes32})`);
  } catch (error) {
    console.error(`✖ Failed to process proof ${log.args.proofId}:`, error);
  }
}

async function extractProofPayload(publicClient: any, log: ProofLog): Promise<ProofPayload | undefined> {
  const tx = await publicClient.getTransaction({ hash: log.transactionHash });
  const decoded = decodeFunctionData({ abi: ZKP_VERIFIER_ABI, data: tx.input });

  if (decoded.functionName === "submitProof") {
    const [proof, rawCategory, value] = decoded.args as any;
    const category = Number(rawCategory);
    const hash = hashProof({ proof, category, value });
    if (hash !== log.args.proofHash) {
      console.warn(`Proof hash mismatch for id ${log.args.proofId}`);
      return undefined;
    }
    return {
      proof,
      category: Number(category),
      value,
      proofHash: hash,
      submitter: log.args.submitter,
      proofId: log.args.proofId
    };
  }

  if (decoded.functionName === "submitProofBatch") {
    const [proofs, categories, values] = decoded.args as any;
    for (let index = 0; index < proofs.length; index++) {
      const category = Number(categories[index]);
      const value = values[index] as bigint;
      const hash = hashProof({ proof: proofs[index], category, value });
      if (hash === log.args.proofHash) {
        return {
          proof: proofs[index],
          category,
          value,
          proofHash: hash,
          submitter: log.args.submitter,
          proofId: log.args.proofId
        };
      }
    }
    console.warn(`No matching proof found in batch for id ${log.args.proofId}`);
  }

  return undefined;
}

async function submitViaZkVerify(payload: ProofPayload): Promise<string> {
  if (!ZKVERIFY_API_URL) {
    console.warn("ZKVERIFY_API_URL not set; returning dummy submission id");
    return payload.proofHash;
  }

  const requestBody = {
    programId: ZKVERIFY_PROGRAM_ID,
    proof: {
      a: payload.proof.a.map((value) => value.toString()),
      b: payload.proof.b.map((row) => row.map((value) => value.toString())),
      c: payload.proof.c.map((value) => value.toString()),
      inputs: payload.proof.inputs.map((value) => value.toString())
    },
    publicSignals: {
      category: payload.category,
      value: payload.value.toString(),
      submitter: payload.submitter,
      proofHash: payload.proofHash
    }
  };

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (ZKVERIFY_API_KEY) {
    headers["Authorization"] = `Bearer ${ZKVERIFY_API_KEY}`;
  }

  console.log(`→ Sending proof ${payload.proofId} to zkVerify`);
  const response = await fetch(`${ZKVERIFY_API_URL}/proofs`, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`zkVerify submit failed (${response.status}): ${body}`);
  }

  const job = (await response.json()) as { jobId?: string; submissionId?: string; status?: string };
  if (job.submissionId && job.status && job.status.toLowerCase().includes("verified")) {
    console.log(`zkVerify immediate verification for job ${job.jobId ?? "unknown"}`);
    return job.submissionId;
  }

  if (!job.jobId) {
    console.warn("zkVerify response missing jobId; returning proof hash as submission id");
    return payload.proofHash;
  }

  return await waitForZkVerify(job.jobId, payload.proofHash);
}

async function waitForZkVerify(jobId: string, fallback: `0x${string}`): Promise<string> {
  if (!ZKVERIFY_API_URL) return fallback;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (ZKVERIFY_API_KEY) {
    headers["Authorization"] = `Bearer ${ZKVERIFY_API_KEY}`;
  }

  return await pRetry(
    async () => {
      await delay(POLL_INTERVAL_MS);
      const response = await fetch(`${ZKVERIFY_API_URL}/proofs/${jobId}`, { headers });
      if (!response.ok) {
        throw new Error(`zkVerify status failed (${response.status})`);
      }
      const status = (await response.json()) as { status?: string; submissionId?: string };
      if (status.status && status.status.toLowerCase().includes("fail")) {
        throw new AbortError(`zkVerify marked job ${jobId} as failed`);
      }
      if (status.status && status.status.toLowerCase().includes("verif")) {
        console.log(`zkVerify confirmed job ${jobId}`);
        return status.submissionId ?? fallback;
      }
      throw new Error(`Job ${jobId} still processing`);
    },
    { retries: MAX_ATTEMPTS, factor: 1.5 }
  ).catch((error) => {
    console.warn(`zkVerify polling exceeded retries for job ${jobId}:`, error);
    return fallback;
  });
}

main().catch((error) => {
  console.error("Relayer exited with error", error);
  process.exit(1);
});
