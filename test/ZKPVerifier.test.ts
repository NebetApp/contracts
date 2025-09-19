import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { network } from "hardhat";
import { decodeEventLog } from "viem";

describe("ZKPVerifier", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [admin, relayer, other] = await viem.getWalletClients();

  let zkpVerifier: any;

  const createMockProof = () => ({
    a: [1n, 2n],
    b: [
      [3n, 4n],
      [5n, 6n]
    ],
    c: [7n, 8n],
    inputs: [9n, 10n]
  });

  function findProofIds(logs: any[]) {
    return logs
      .filter((log) => log.address.toLowerCase() === zkpVerifier.address.toLowerCase())
      .map((log) => {
        const parsed = decodeEventLog({
          abi: zkpVerifier.abi,
          data: log.data,
          topics: log.topics
        }) as { eventName: string; args?: Record<string, unknown> };
        if (parsed.eventName === "ProofSubmitted" && parsed.args) {
          return parsed.args.proofId as bigint;
        }
        return undefined;
      })
      .filter((value): value is bigint => value !== undefined);
  }

  beforeEach(async function () {
    zkpVerifier = await viem.deployContract("ZKPVerifier", [admin.account.address, relayer.account.address]);
  });

  it("stores proof submissions and exposes metadata", async function () {
    const proof = createMockProof();
    const category = 0;
    const value = 1990n;

    const hash = await zkpVerifier.write.submitProof([proof, category, value]);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const [proofId] = findProofIds(receipt.logs);

    const info = await zkpVerifier.read.proofInfo([proofId]);

    assert.equal(info[0].toLowerCase(), admin.account.address.toLowerCase());
    assert.equal(Number(info[1]), category);
    assert.equal(info[2], value);
    assert.equal(info[4], false);
  });

  it("supports batch submissions", async function () {
    const proofs = [createMockProof(), createMockProof()];
    const categories = [0, 1];
    const values = [1990n, 1n];

    const hash = await zkpVerifier.write.submitProofBatch([proofs, categories, values]);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const proofIds = findProofIds(receipt.logs);

    assert.equal(proofIds.length, 2);
    assert.ok(proofIds[0] !== proofIds[1]);
  });

  it("only the relayer can mark proofs as verified", async function () {
    const proof = createMockProof();
    const hash = await zkpVerifier.write.submitProof([proof, 0, 1990n]);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const [proofId] = findProofIds(receipt.logs);

    try {
      await zkpVerifier.write.markVerified([proofId, "0x".padEnd(66, "0")], { account: other.account });
      assert.fail("Expected NotRelayer error");
    } catch (error: any) {
      const message = error?.message ?? String(error);
      assert.ok(message.includes("NotRelayer"));
    }

    await zkpVerifier.write.markVerified([proofId, "0x".padEnd(66, "1")], { account: relayer.account });

    const isVerified = await zkpVerifier.read.isVerified([proofId]);
    assert.equal(isVerified, true);

    const count = await zkpVerifier.read.getDemographicCount([0, 1990n]);
    assert.equal(count, 1n);
  });

  it("prevents double verification", async function () {
    const proof = createMockProof();
    const hash = await zkpVerifier.write.submitProof([proof, 1, 7n]);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const [proofId] = findProofIds(receipt.logs);

    await zkpVerifier.write.markVerified([proofId, "0x".padEnd(66, "2")], { account: relayer.account });
    await assert.rejects(
      zkpVerifier.write.markVerified([proofId, "0x".padEnd(66, "3")], { account: relayer.account }),
      /AlreadyVerified/
    );
  });

  it("marks batches and updates counts", async function () {
    const proofs = [createMockProof(), createMockProof()];
    const categories = [0, 0];
    const values = [2000n, 2000n];

    const hash = await zkpVerifier.write.submitProofBatch([proofs, categories, values]);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const proofIds = findProofIds(receipt.logs);

    await zkpVerifier.write.markVerifiedBatch(
      [proofIds, ["0x".padEnd(66, "4"), "0x".padEnd(66, "5")]],
      { account: relayer.account }
    );

    const count = await zkpVerifier.read.getDemographicCount([0, 2000n]);
    assert.equal(count, 2n);
  });
});
