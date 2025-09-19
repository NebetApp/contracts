import { useEffect, useMemo, useState } from "react";
import type { Address, Hash } from "viem";
import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  createWalletClient,
  custom,
  decodeEventLog,
  formatUnits,
  http,
  keccak256,
  parseUnits,
  stringToHex
} from "viem";
import { hardhat } from "viem/chains";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import nacl from "tweetnacl";
import * as naclUtil from "tweetnacl-util";
import {
  ACCESS_MANAGER_ABI,
  ANALYTICS_ABI,
  FUNDING_HUB_ABI,
  HEALTH_PASSPORT_ABI,
  MOCK_ERC20_ABI,
  TREATMENT_CAMPAIGN_ABI,
  ZKP_VERIFIER_ABI
} from "./abi";
import { CONTRACTS } from "./config";

const RPC_URL = "http://127.0.0.1:8545";

function isAddressLike(value: string): value is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

function formatHash(hash: Hash | undefined) {
  if (!hash) return "";
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`;
}

type NormalizedProof = {
  a: readonly [bigint, bigint];
  b: readonly [readonly [bigint, bigint], readonly [bigint, bigint]];
  c: readonly [bigint, bigint];
  inputs: readonly bigint[];
};

type AttachedProof = {
  json: string;
  category: string;
  value: string;
};

function normalizeProof(json: string): NormalizedProof {
  const parsed = JSON.parse(json);
  const toPair = (value: any): readonly [bigint, bigint] => [
    BigInt(value?.[0] ?? 0),
    BigInt(value?.[1] ?? 0)
  ] as const;

  return {
    a: toPair(parsed.a),
    b: [toPair(parsed.b?.[0]), toPair(parsed.b?.[1])] as const,
    c: toPair(parsed.c),
    inputs: (Array.isArray(parsed.inputs) ? parsed.inputs.map((value: any) => BigInt(value ?? 0)) : []) as ReadonlyArray<bigint>
  };
}

const textEncoder = new TextEncoder();

function encodeBase64(value: string) {
  return window.btoa(unescape(encodeURIComponent(value)));
}

function encodeBase64Bytes(value: Uint8Array) {
  return naclUtil.encodeBase64(value);
}

function decodeBase64(value: string) {
  return naclUtil.decodeBase64(value);
}

function jsonToHex(value: string | object) {
  const json = typeof value === "string" ? value : JSON.stringify(value);
  const bytes = textEncoder.encode(json);
  let hex = "0x";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

function encryptWithPublicKey(publicKeyBase64: string, plaintext: string) {
  const publicKey = decodeBase64(publicKeyBase64);
  const ephemKeyPair = nacl.box.keyPair();
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const messageUint8 = naclUtil.decodeUTF8(plaintext);
  const ciphertext = nacl.box(messageUint8, nonce, publicKey, ephemKeyPair.secretKey);

  return {
    version: "x25519-xsalsa20-poly1305",
    nonce: encodeBase64Bytes(nonce),
    ephemPublicKey: encodeBase64Bytes(ephemKeyPair.publicKey),
    ciphertext: encodeBase64Bytes(ciphertext)
  };
}

function randomBytes32Hex() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let hex = "0x";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex as `0x${string}`;
}

function ensureBytes32(value: string) {
  let trimmed = value.trim();
  if (trimmed.length === 0) {
    return randomBytes32Hex();
  }
  if (!trimmed.startsWith("0x")) {
    trimmed = `0x${trimmed}`;
  }
  if (trimmed.length !== 66) {
    throw new Error("Submission id must be 32 bytes");
  }
  return trimmed as `0x${string}`;
}

const ENCRYPTED_FIELD_KEYS = [
  "encryptedName",
  "encryptedBirthDate",
  "encryptedNationality",
  "encryptedVaccines",
  "encryptedMedications",
  "encryptedAllergies",
  "encryptedTreatments"
] as const;

type EncryptedFieldKey = typeof ENCRYPTED_FIELD_KEYS[number];

type PassportFormState = {
  dataURI: string;
  dataHashInput: string;
  verificationURI: string;
  tokenId: string;
  reason: string;
} & Record<EncryptedFieldKey, string>;

const ENCRYPTED_FIELD_LABEL: Record<EncryptedFieldKey, string> = {
  encryptedName: "Encrypted name blob",
  encryptedBirthDate: "Encrypted birth date blob",
  encryptedNationality: "Encrypted nationality blob",
  encryptedVaccines: "Encrypted vaccination history",
  encryptedMedications: "Encrypted medications",
  encryptedAllergies: "Encrypted allergies",
  encryptedTreatments: "Encrypted treatments"
};

const SAMPLE_PROOF_JSON = JSON.stringify(
  {
    a: [1, 2],
    b: [
      [3, 4],
      [5, 6]
    ],
    c: [7, 8],
    inputs: [12345]
  },
  null,
  2
);

function extractErrorMessage(error: unknown): string {
  if (error instanceof BaseError) {
    let revertError: ContractFunctionRevertedError | undefined;
    error.walk((err) => {
      if (err instanceof ContractFunctionRevertedError) {
        revertError = err;
        return true;
      }
      return false;
    });

    if (revertError) {
      const errorName = revertError.data?.errorName;
      if (errorName) {
        const args = revertError.data?.args;
        const formattedArgs = Array.isArray(args) && args.length > 0 ? `(${args.map(String).join(", ")})` : "";
        return `${errorName}${formattedArgs}`;
      }
      return revertError.shortMessage || "Transaction reverted";
    }
    return error.shortMessage || error.message;
  }
  if (error instanceof Error) return error.message;
  try {
    return String(error);
  } catch (castError) {
    return "Unknown error";
  }
}

export default function App() {
  const [account, setAccount] = useState<Address>();
  const [chainId, setChainId] = useState<number>();
  const [status, setStatus] = useState<{ message: string; kind: "info" | "success" | "error"; hash?: Hash } | null>(null);
  const [campaignAddress, setCampaignAddress] = useState<string>("");

  const queryClient = useQueryClient();

  const publicClient = useMemo(
    () => createPublicClient({ chain: hardhat, transport: http(RPC_URL) }),
    []
  );

  const walletClient = useMemo(() => {
    if (!account || typeof window === "undefined" || !window.ethereum) return undefined;
    return createWalletClient({ account, chain: hardhat, transport: custom(window.ethereum) });
  }, [account]);

  useEffect(() => {
    const provider = window.ethereum;
    if (!provider) return;

    const handleAccountsChanged = (accounts: string[]) => {
      const next = accounts[0] as Address | undefined;
      setAccount(next);
    };
    const handleChainChanged = (nextChainId: string) => {
      setChainId(Number(nextChainId));
      queryClient.invalidateQueries();
    };

    provider.on?.("accountsChanged", handleAccountsChanged);
    provider.on?.("chainChanged", handleChainChanged);

    provider
      .request({ method: "eth_accounts" })
      .then((accounts: string[]) => {
        if (accounts.length > 0 && isAddressLike(accounts[0])) {
          setAccount(accounts[0] as Address);
        }
      })
      .catch(() => {});

    provider
      .request({ method: "eth_chainId" })
      .then((id: string) => setChainId(Number(id)))
      .catch(() => {});

    return () => {
      provider.removeListener?.("accountsChanged", handleAccountsChanged);
      provider.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [queryClient]);

  const tokenMetaQuery = useQuery({
    queryKey: ["token-meta"],
    queryFn: async () => {
      const [name, symbol, decimals] = await Promise.all([
        publicClient.readContract({ address: CONTRACTS.mockUsdt, abi: MOCK_ERC20_ABI, functionName: "name" }),
        publicClient.readContract({ address: CONTRACTS.mockUsdt, abi: MOCK_ERC20_ABI, functionName: "symbol" }),
        publicClient.readContract({ address: CONTRACTS.mockUsdt, abi: MOCK_ERC20_ABI, functionName: "decimals" })
      ]);
      return { name, symbol, decimals: Number(decimals) };
    },
    enabled: isAddressLike(CONTRACTS.mockUsdt)
  });

  const globalMetricsQuery = useQuery({
    queryKey: ["analytics", "global-metrics"],
    queryFn: async () => {
      const result = await publicClient.readContract({
        address: CONTRACTS.analytics,
        abi: ANALYTICS_ABI,
        functionName: "getGlobalMetrics"
      });
      return {
        totalPassports: result[0],
        verifiedPassports: result[1],
        totalRevenue: result[2],
        lastUpdated: result[3]
      };
    },
    enabled: isAddressLike(CONTRACTS.analytics)
  });

  const balanceQuery = useQuery({
    queryKey: ["balance", account],
    queryFn: async () => {
      if (!account) return 0n;
      return await publicClient.readContract({
        address: CONTRACTS.mockUsdt,
        abi: MOCK_ERC20_ABI,
        functionName: "balanceOf",
        args: [account]
      });
    },
    enabled: Boolean(account && isAddressLike(CONTRACTS.mockUsdt))
  });

  async function connectWallet() {
    const provider = window.ethereum;
    if (!provider) {
      setStatus({ message: "Install MetaMask or use an injected provider", kind: "error" });
      return;
    }
    const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
    if (accounts.length === 0) {
      setStatus({ message: "No account returned", kind: "error" });
      return;
    }
    const selected = accounts[0];
    if (!isAddressLike(selected)) {
      setStatus({ message: "Invalid account address", kind: "error" });
      return;
    }
    setAccount(selected as Address);
    const id = await provider.request({ method: "eth_chainId" });
    setChainId(Number(id));
    setStatus({ message: `Connected ${selected}`, kind: "success" });
  }

  async function writeTx<T>(description: string, fn: () => Promise<Hash>) {
    if (!walletClient || !account) {
      setStatus({ message: "Connect a wallet first", kind: "error" });
      return;
    }
    try {
      setStatus({ message: `${description} (waiting for wallet confirmation)`, kind: "info" });
      const hash = await fn();
      setStatus({ message: `${description} sent`, kind: "info", hash });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setStatus({ message: `${description} confirmed in block ${receipt.blockNumber}`, kind: "success", hash });
      queryClient.invalidateQueries();
    } catch (error) {
      setStatus({ message: extractErrorMessage(error), kind: "error" });
    }
  }

  const [verifierForm, setVerifierForm] = useState({ address: "", name: "", uri: "" });
  const [lookupAddress, setLookupAddress] = useState<string>("");
  const [lookupResult, setLookupResult] = useState<string>("");

  async function checkVerifier() {
    if (!isAddressLike(lookupAddress)) {
      setLookupResult("Enter a valid address");
      return;
    }
    try {
      const [isVerifier, infoTuple] = await Promise.all([
        publicClient.readContract({
          address: CONTRACTS.accessManager,
          abi: ACCESS_MANAGER_ABI,
          functionName: "isVerifier",
          args: [lookupAddress as Address]
        }),
        publicClient.readContract({
          address: CONTRACTS.accessManager,
          abi: ACCESS_MANAGER_ABI,
          functionName: "verifierInfo",
          args: [lookupAddress as Address]
        })
      ]);
      const { active, name, uri } = infoTuple as { active: boolean; name: string; uri: string };
      setLookupResult(`isVerifier: ${isVerifier}\nname: ${name}\nuri: ${uri}\nactive: ${active}`);
    } catch (error) {
      setLookupResult(extractErrorMessage(error));
    }
  }

  async function encryptField(field: EncryptedFieldKey) {
    if (!account) {
      setStatus({ message: "Connect a wallet before encrypting", kind: "error" });
      return;
    }
    const provider = window.ethereum;
    if (!provider) {
      setStatus({ message: "No wallet provider detected", kind: "error" });
      return;
    }

    const plaintext = passportForm[field];
    if (!plaintext) {
      setStatus({ message: `Enter plaintext for ${ENCRYPTED_FIELD_LABEL[field]}`, kind: "error" });
      return;
    }

    try {
      setStatus({ message: `Encrypting ${ENCRYPTED_FIELD_LABEL[field]} with wallet key`, kind: "info" });
      const publicKey = (await provider.request({ method: "eth_getEncryptionPublicKey", params: [account] })) as string;
      const payload = encryptWithPublicKey(publicKey, plaintext);
      const encoded = `wallet://${jsonToHex(payload)}`;
      setPassportForm((prev) => ({ ...prev, [field]: encoded }));
      setStatus({ message: `${ENCRYPTED_FIELD_LABEL[field]} encrypted`, kind: "success" });
    } catch (error) {
      setStatus({ message: extractErrorMessage(error), kind: "error" });
    }
  }

  function addProofToMint() {
    try {
      normalizeProof(proofDraft.json);
    } catch (error) {
      setStatus({ message: extractErrorMessage(error), kind: "error" });
      return;
    }

    setAttachedProofs((prev) => [...prev, { ...proofDraft }]);
    setProofDraft((prev) => ({ ...prev, json: prev.json }));
    setStatus({ message: "Proof prepared for mint", kind: "info" });
  }

  function removeProof(index: number) {
    setAttachedProofs((prev) => prev.filter((_, i) => i !== index));
  }

  async function fetchVerifiedDemographicCount() {
    try {
      const count = await publicClient.readContract({
        address: CONTRACTS.analytics,
        abi: ANALYTICS_ABI,
        functionName: "getVerifiedDemographicCount",
        args: [Number(demographicLookup.category), BigInt(demographicLookup.value || "0")]
      });
      setDemographicLookup((prev) => ({ ...prev, result: count.toString() }));
    } catch (error) {
      setStatus({ message: extractErrorMessage(error), kind: "error" });
    }
  }

  async function loadAndDecryptUserData(tokenId: string) {
    if (!account) {
      setStatus({ message: "Connect a wallet first", kind: "error" });
      return;
    }
    try {
      const userData = await publicClient.readContract({
        address: CONTRACTS.healthPassport,
        abi: HEALTH_PASSPORT_ABI,
        functionName: "getUserData",
        args: [BigInt(tokenId || "0")],
        account: account as Address
      });

      const userDataRecord = {
        encryptedName: userData[0] as string,
        encryptedBirthDate: userData[1] as string,
        encryptedNationality: userData[2] as string,
        encryptedVaccines: userData[3] as string,
        encryptedMedications: userData[4] as string,
        encryptedAllergies: userData[5] as string,
        encryptedTreatments: userData[6] as string
      } satisfies Record<EncryptedFieldKey, string>;

      const provider = window.ethereum;
      if (!provider) {
        setStatus({ message: "No wallet provider detected", kind: "error" });
        return;
      }

      const decrypted: Record<string, string> = {};
      for (const field of ENCRYPTED_FIELD_KEYS) {
        const value = userDataRecord[field];
        if (!value) continue;
        if (!value.startsWith("wallet://")) {
          decrypted[field] = value;
          continue;
        }
        try {
          const rawPayload = value.slice("wallet://".length);
          let payloadHex: string;
          if (rawPayload.startsWith("0x")) {
            payloadHex = rawPayload;
          } else {
            const payloadJson = window.atob(rawPayload);
            payloadHex = jsonToHex(payloadJson);
          }

          const plaintext = await provider.request({
            method: "eth_decrypt",
            params: [payloadHex, account]
          });
          decrypted[field] = plaintext as string;
        } catch (error) {
          decrypted[field] = "<decrypt failed>";
          setStatus({ message: extractErrorMessage(error), kind: "error" });
        }
      }

      setDecryptedData(JSON.stringify(decrypted, null, 2));
      setStatus({ message: "Decrypted passport data loaded", kind: "success" });
    } catch (error) {
      setStatus({ message: extractErrorMessage(error), kind: "error" });
    }
  }

  async function loadProofRecords(tokenId: string) {
    try {
      const records = await publicClient.readContract({
        address: CONTRACTS.healthPassport,
        abi: HEALTH_PASSPORT_ABI,
        functionName: "getProofRecords",
        args: [BigInt(tokenId || "0")]
      });

      const [rawProofIds, rawCategories, rawValues, rawVerified] = records as [
        readonly bigint[],
        readonly number[],
        readonly bigint[],
        readonly boolean[]
      ];

      const proofIds = Array.from(rawProofIds, (value) => value);
      const categories = Array.from(rawCategories, (value) => value);
      const values = Array.from(rawValues, (value) => value);
      const verified = Array.from(rawVerified, (value) => value);

      const lines = proofIds.map((id, index) => {
        return `proofId: ${id.toString()} | category: ${categories[index]} | value: ${values[index].toString()} | verified: ${verified[index]}`;
      });
      setProofRecordsOutput(lines.join("\n"));
    } catch (error) {
      setProofRecordsOutput("");
      setStatus({ message: extractErrorMessage(error), kind: "error" });
    }
  }

  async function markProofVerifiedRelayer() {
    if (!walletClient || !account) {
      setStatus({ message: "Connect a wallet first", kind: "error" });
      return;
    }
    try {
      const submissionId = ensureBytes32(relayerForm.submissionId);
      await writeTx("Mark proof verified", () =>
        walletClient!.writeContract({
          address: CONTRACTS.zkpVerifier,
          abi: ZKP_VERIFIER_ABI,
          functionName: "markVerified",
          args: [BigInt(relayerForm.proofId || "0"), submissionId]
        })
      );
    } catch (error) {
      setStatus({ message: extractErrorMessage(error), kind: "error" });
    }
  }

  async function fetchProofInfo() {
    try {
      const info = await publicClient.readContract({
        address: CONTRACTS.zkpVerifier,
        abi: ZKP_VERIFIER_ABI,
        functionName: "proofInfo",
        args: [BigInt(relayerForm.proofId || "0")]
      });
      const [submitter, category, value, proofHash, verified, submissionId] = info as [string, number, bigint, string, boolean, string];
      setProofInfoOutput(
        `submitter: ${submitter}\ncategory: ${category}\nvalue: ${value.toString()}\nproofHash: ${proofHash}\nverified: ${verified}\nsubmissionId: ${submissionId}`
      );
    } catch (error) {
      setProofInfoOutput("");
      setStatus({ message: extractErrorMessage(error), kind: "error" });
    }
  }

  const [mintAmount, setMintAmount] = useState("1000");
  const [approveAmount, setApproveAmount] = useState("100");
  const [approveSpender, setApproveSpender] = useState<string>(CONTRACTS.healthPassport);
  const decimals = tokenMetaQuery.data?.decimals ?? 6;

  const [passportForm, setPassportForm] = useState<PassportFormState>({
    dataURI: "ipfs://placeholder",
    dataHashInput: "",
    verificationURI: "https://example.com/report",
    tokenId: "1",
    reason: "Manual revoke by admin",
    encryptedName: "",
    encryptedBirthDate: "",
    encryptedNationality: "",
    encryptedVaccines: "",
    encryptedMedications: "",
    encryptedAllergies: "",
    encryptedTreatments: ""
  });

  const [campaignForm, setCampaignForm] = useState({
    passportId: "1",
    goal: "1000",
    deadlineMinutes: "60",
    payout: "",
    tokenAddress: CONTRACTS.mockUsdt
  });

  const [pledgeForm, setPledgeForm] = useState({ amount: "100", campaign: "" });
  const [demographicLookup, setDemographicLookup] = useState({ category: "1", value: "0", result: "" });

  const [attachedProofs, setAttachedProofs] = useState<AttachedProof[]>([]);
  const [proofDraft, setProofDraft] = useState<AttachedProof>({
    json: SAMPLE_PROOF_JSON,
    category: "0",
    value: "1990"
  });
  const [decryptedData, setDecryptedData] = useState<string>("");
  const [proofRecordsOutput, setProofRecordsOutput] = useState<string>("");
  const [relayerForm, setRelayerForm] = useState({ proofId: "", submissionId: "" });
  const [proofInfoOutput, setProofInfoOutput] = useState<string>("");

  function currentCampaignAddress(): Address | undefined {
    const target = (pledgeForm.campaign || campaignAddress).trim();
    if (isAddressLike(target)) return target as Address;
    return undefined;
  }

  return (
    <div className="app">
      <header className="section">
        <h1>Nebet Local Manual Tester</h1>
        <p>
          Connect a wallet (Hardhat accounts via MetaMask or Rabby), deploy contracts to localhost, and use the panels below to test flows.
        </p>
        <div className="grid">
          <div>
            <button onClick={connectWallet}>Connect Wallet</button>
            <div className="status">
              <span>Account: {account ?? "—"}</span>
              <span>Chain: {chainId ?? "—"}</span>
            </div>
          </div>
          <div className="status">
            <span>AccessManager: {CONTRACTS.accessManager}</span>
            <span>HealthPassport: {CONTRACTS.healthPassport}</span>
            <span>FundingHub: {CONTRACTS.fundingHub}</span>
            <span>MockUSDT: {CONTRACTS.mockUsdt}</span>
          </div>
        </div>
        {status && (
          <pre>
            [{status.kind}] {status.message}
            {status.hash ? `\nTx: ${formatHash(status.hash)}` : ""}
          </pre>
        )}
      </header>

      <section className="section">
        <h2>AccessManager</h2>
        <fieldset>
          <legend>Add / Remove Verifier</legend>
          <label>
            Verifier address
            <input
              placeholder="0x…"
              value={verifierForm.address}
              onChange={(event) => setVerifierForm((prev) => ({ ...prev, address: event.target.value }))}
            />
          </label>
          <label>
            Name
            <input
              placeholder="Clinic name"
              value={verifierForm.name}
              onChange={(event) => setVerifierForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </label>
          <label>
            URI
            <input
              placeholder="https://…"
              value={verifierForm.uri}
              onChange={(event) => setVerifierForm((prev) => ({ ...prev, uri: event.target.value }))}
            />
          </label>
          <div className="grid">
            <button
              onClick={() =>
                writeTx("Add verifier", () =>
                  walletClient!.writeContract({
                    address: CONTRACTS.accessManager,
                    abi: ACCESS_MANAGER_ABI,
                    functionName: "addVerifier",
                    args: [verifierForm.address as Address, verifierForm.name, verifierForm.uri]
                  })
                )
              }
              disabled={!isAddressLike(CONTRACTS.accessManager) || !isAddressLike(verifierForm.address)}
            >
              Add Verifier
            </button>
            <button
              className="secondary"
              onClick={() =>
                writeTx("Remove verifier", () =>
                  walletClient!.writeContract({
                    address: CONTRACTS.accessManager,
                    abi: ACCESS_MANAGER_ABI,
                    functionName: "removeVerifier",
                    args: [verifierForm.address as Address]
                  })
                )
              }
              disabled={!isAddressLike(CONTRACTS.accessManager) || !isAddressLike(verifierForm.address)}
            >
              Remove Verifier
            </button>
          </div>
        </fieldset>
        <fieldset>
          <legend>Lookup</legend>
          <label>
            Address
            <input value={lookupAddress} onChange={(event) => setLookupAddress(event.target.value)} placeholder="0x…" />
          </label>
          <button className="secondary" onClick={checkVerifier} disabled={!isAddressLike(CONTRACTS.accessManager)}>
            Check Verifier
          </button>
          {lookupResult && <pre>{lookupResult}</pre>}
        </fieldset>
      </section>

      <section className="section">
        <h2>Mock USDT</h2>
        <div className="grid">
          <div>
            <div className="status">
              <span>
                Balance: {balanceQuery.data ? formatUnits(balanceQuery.data, decimals) : "—"}{" "}
                {tokenMetaQuery.data?.symbol ?? "USDT"}
              </span>
            </div>
            <label>
              Mint amount
              <input value={mintAmount} onChange={(event) => setMintAmount(event.target.value)} />
            </label>
            <button
              onClick={() =>
                writeTx("Mint tokens", () =>
                  walletClient!.writeContract({
                    address: CONTRACTS.mockUsdt,
                    abi: MOCK_ERC20_ABI,
                    functionName: "mint",
                    args: [account!, parseUnits(mintAmount || "0", decimals)]
                  })
                )
              }
              disabled={!account || !isAddressLike(CONTRACTS.mockUsdt)}
            >
              Mint
            </button>
          </div>
          <div>
            <label>
              Approve amount
              <input value={approveAmount} onChange={(event) => setApproveAmount(event.target.value)} />
            </label>
            <label>
              Spender
              <input value={approveSpender} onChange={(event) => setApproveSpender(event.target.value)} placeholder="0x…" />
            </label>
            <button
              onClick={() =>
                writeTx("Approve HealthPassport", () =>
                  walletClient!.writeContract({
                    address: CONTRACTS.mockUsdt,
                    abi: MOCK_ERC20_ABI,
                    functionName: "approve",
                    args: [approveSpender as Address, parseUnits(approveAmount || "0", decimals)]
                  })
                )
              }
              disabled={!account || !isAddressLike(CONTRACTS.mockUsdt) || !isAddressLike(approveSpender)}
            >
              Approve Spender
            </button>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>Health Passport</h2>
        <fieldset>
          <legend>Mint Passport</legend>
          <label>
            Data URI
            <input value={passportForm.dataURI} onChange={(event) => setPassportForm((prev) => ({ ...prev, dataURI: event.target.value }))} />
          </label>
          <label>
            Plaintext to hash (optional helper)
            <input
              value={passportForm.dataHashInput}
              onChange={(event) => setPassportForm((prev) => ({ ...prev, dataHashInput: event.target.value }))}
              placeholder="Will hash to bytes32"
            />
          </label>
          {ENCRYPTED_FIELD_KEYS.map((field) => (
            <div key={field} className="encrypted-field">
              <label>
                {ENCRYPTED_FIELD_LABEL[field]}
                <textarea
                  rows={2}
                  value={passportForm[field]}
                  onChange={(event) => setPassportForm((prev) => ({ ...prev, [field]: event.target.value }))}
                />
              </label>
              <button
                type="button"
                className="secondary"
                onClick={() => encryptField(field)}
                disabled={!account}
              >
                Encrypt with wallet
              </button>
            </div>
          ))}
          <fieldset>
            <legend>Attach demographic proofs (optional)</legend>
            <label>
              Proof JSON
              <textarea
                rows={4}
                value={proofDraft.json}
                onChange={(event) => setProofDraft((prev) => ({ ...prev, json: event.target.value }))}
              />
            </label>
            <div className="grid">
              <label>
                Category (enum index)
                <input value={proofDraft.category} onChange={(event) => setProofDraft((prev) => ({ ...prev, category: event.target.value }))} />
              </label>
              <label>
                Value
                <input value={proofDraft.value} onChange={(event) => setProofDraft((prev) => ({ ...prev, value: event.target.value }))} />
              </label>
            </div>
            <button type="button" className="secondary" onClick={addProofToMint}>
              Add Proof to Mint
            </button>
            {attachedProofs.length > 0 && (
              <div className="proof-list">
                <strong>Proofs queued for verification</strong>
                {attachedProofs.map((proof, index) => (
                  <div key={`${proof.category}-${proof.value}-${index}`} className="proof-item">
                    <pre>
                      category: {proof.category}\nvalue: {proof.value}\n{proof.json}
                    </pre>
                    <button type="button" className="secondary" onClick={() => removeProof(index)}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </fieldset>
          <button
            className="secondary"
            onClick={() => {
              if (!passportForm.dataHashInput) {
                setStatus({ message: "Enter text to hash", kind: "error" });
                return;
              }
              const hashed = keccak256(stringToHex(passportForm.dataHashInput));
              setPassportForm((prev) => ({ ...prev, dataHashInput: hashed }));
            }}
          >
            Hash Plaintext
          </button>
          <button
            onClick={() => {
              const dataHash = passportForm.dataHashInput || keccak256(stringToHex(passportForm.dataURI));
              try {
                const normalizedProofs = attachedProofs.map((proof) => normalizeProof(proof.json));
                const proofsForMint = normalizedProofs.map((proof) => [proof.a, proof.b, proof.c, proof.inputs] as const);
                const categoriesForMint = attachedProofs.map((proof) => Number(proof.category));
                const valuesForMint = attachedProofs.map((proof) => BigInt(proof.value || "0"));

                void writeTx("Mint passport", () =>
                  walletClient!.writeContract({
                    address: CONTRACTS.healthPassport,
                    abi: HEALTH_PASSPORT_ABI,
                    functionName: "mintPassport",
                    args: [
                      passportForm.dataURI,
                      dataHash as `0x${string}`,
                      [
                        passportForm.encryptedName,
                        passportForm.encryptedBirthDate,
                        passportForm.encryptedNationality,
                        passportForm.encryptedVaccines,
                        passportForm.encryptedMedications,
                        passportForm.encryptedAllergies,
                        passportForm.encryptedTreatments
                      ],
                      proofsForMint,
                      categoriesForMint,
                      valuesForMint
                    ]
                  })
                );
              } catch (error) {
                setStatus({ message: extractErrorMessage(error), kind: "error" });
              }
            }}
            disabled={!account || !isAddressLike(CONTRACTS.healthPassport)}
          >
            Mint Passport
          </button>
        </fieldset>
        <fieldset>
          <legend>Verification Flow</legend>
          <label>
            Passport tokenId
            <input value={passportForm.tokenId} onChange={(event) => setPassportForm((prev) => ({ ...prev, tokenId: event.target.value }))} />
          </label>
          <button
            type="button"
            className="secondary"
            onClick={() => loadAndDecryptUserData(passportForm.tokenId)}
            disabled={!account || !isAddressLike(CONTRACTS.healthPassport)}
          >
            Load & Decrypt User Data
          </button>
          {decryptedData && (
            <pre>{decryptedData}</pre>
          )}
          <button
            type="button"
            className="secondary"
            onClick={() => loadProofRecords(passportForm.tokenId)}
            disabled={!isAddressLike(CONTRACTS.healthPassport)}
          >
            Fetch Proof Records
          </button>
          {proofRecordsOutput && <pre>{proofRecordsOutput}</pre>}
          <div className="grid">
            <button
              onClick={() =>
                writeTx("Submit passport for verification", () =>
                  walletClient!.writeContract({
                    address: CONTRACTS.healthPassport,
                    abi: HEALTH_PASSPORT_ABI,
                    functionName: "submitForVerification",
                    args: [BigInt(passportForm.tokenId || "0")]
                  })
                )
              }
              disabled={!account || !isAddressLike(CONTRACTS.healthPassport)}
            >
              Submit
            </button>
            <button
              onClick={() =>
                writeTx("Verify passport", () =>
                  walletClient!.writeContract({
                    address: CONTRACTS.healthPassport,
                    abi: HEALTH_PASSPORT_ABI,
                    functionName: "verify",
                    args: [BigInt(passportForm.tokenId || "0"), true, passportForm.verificationURI]
                  })
                )
              }
              disabled={!account || !isAddressLike(CONTRACTS.healthPassport)}
            >
              Approve
            </button>
            <button
              className="secondary"
              onClick={() =>
                writeTx("Reject passport", () =>
                  walletClient!.writeContract({
                    address: CONTRACTS.healthPassport,
                    abi: HEALTH_PASSPORT_ABI,
                    functionName: "verify",
                    args: [BigInt(passportForm.tokenId || "0"), false, passportForm.verificationURI]
                  })
                )
              }
              disabled={!account || !isAddressLike(CONTRACTS.healthPassport)}
            >
              Reject
            </button>
            <button
              className="secondary"
              onClick={() =>
                writeTx("Revoke passport", () =>
                  walletClient!.writeContract({
                    address: CONTRACTS.healthPassport,
                    abi: HEALTH_PASSPORT_ABI,
                    functionName: "revoke",
                    args: [BigInt(passportForm.tokenId || "0"), passportForm.reason]
                  })
                )
              }
              disabled={!account || !isAddressLike(CONTRACTS.healthPassport)}
            >
              Revoke
            </button>
          </div>
          <button
            className="secondary"
            onClick={async () => {
              try {
                const details = await publicClient.readContract({
                  address: CONTRACTS.healthPassport,
                  abi: HEALTH_PASSPORT_ABI,
                  functionName: "passportOf",
                  args: [BigInt(passportForm.tokenId || "0")]
                });
                setStatus({
                  message: `Owner ${details[0]}\nStatus ${details[5]}\nVerifier ${details[6]}\nDataURI ${details[1]}`,
                  kind: "info"
                });
              } catch (error) {
                setStatus({ message: extractErrorMessage(error), kind: "error" });
              }
            }}
          >
            Fetch Passport Info
          </button>
        </fieldset>
      </section>

      <section className="section">
        <h2>Analytics</h2>
        <div className="grid">
          <div>
            <strong>Global Metrics</strong>
            {globalMetricsQuery.data ? (
              <pre>
                totalPassports: {globalMetricsQuery.data.totalPassports.toString()}\nverifiedPassports: {globalMetricsQuery.data.verifiedPassports.toString()}\ntotalRevenue: {formatUnits(globalMetricsQuery.data.totalRevenue, decimals)}\nlastUpdated: {new Date(Number(globalMetricsQuery.data.lastUpdated) * 1000).toLocaleString()}
              </pre>
            ) : (
              <p className="small">Call mint + verify to populate analytics.</p>
            )}
          </div>
          <div>
            <strong>Verified demographic lookup</strong>
            <div className="grid">
              <label>
                Category (enum index)
                <input
                  value={demographicLookup.category}
                  onChange={(event) => setDemographicLookup((prev) => ({ ...prev, category: event.target.value }))}
                />
              </label>
              <label>
                Value
                <input
                  value={demographicLookup.value}
                  onChange={(event) => setDemographicLookup((prev) => ({ ...prev, value: event.target.value }))}
                />
              </label>
            </div>
            <button className="secondary" onClick={fetchVerifiedDemographicCount} disabled={!isAddressLike(CONTRACTS.analytics)}>
              Fetch Verified Count
            </button>
            {demographicLookup.result && (
              <pre>count: {demographicLookup.result}</pre>
            )}
          </div>
          <div>
            <button
              onClick={() =>
                writeTx("Create analytics package", () =>
                  walletClient!.writeContract({
                    address: CONTRACTS.analytics,
                    abi: ANALYTICS_ABI,
                    functionName: "createAnalyticsPackage",
                    args: [
                      "Baseline Package",
                      "Total passports and verified counts",
                      parseUnits("10", decimals),
                      [0n, 1n, 2n]
                    ]
                  })
                )
              }
              disabled={!account || !isAddressLike(CONTRACTS.analytics)}
            >
              Create Sample Package (10 USDT)
            </button>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>Funding Hub</h2>
        <fieldset>
          <legend>Create Campaign</legend>
          <label>
            Beneficiary Passport ID
            <input value={campaignForm.passportId} onChange={(event) => setCampaignForm((prev) => ({ ...prev, passportId: event.target.value }))} />
          </label>
          <label>
            Funding Goal ({tokenMetaQuery.data?.symbol ?? "USDT"})
            <input value={campaignForm.goal} onChange={(event) => setCampaignForm((prev) => ({ ...prev, goal: event.target.value }))} />
          </label>
          <label>
            Deadline (minutes from now)
            <input value={campaignForm.deadlineMinutes} onChange={(event) => setCampaignForm((prev) => ({ ...prev, deadlineMinutes: event.target.value }))} />
          </label>
          <label>
            Payout address (optional)
            <input value={campaignForm.payout} onChange={(event) => setCampaignForm((prev) => ({ ...prev, payout: event.target.value }))} />
          </label>
          <button
            onClick={() =>
              writeTx("Create campaign", async () => {
                const deadlineSeconds = BigInt(Math.floor(Date.now() / 1000 + Number(campaignForm.deadlineMinutes || "0") * 60));
                const hash = await walletClient!.writeContract({
                  address: CONTRACTS.fundingHub,
                  abi: FUNDING_HUB_ABI,
                  functionName: "createCampaign",
                  args: [
                    BigInt(campaignForm.passportId || "0"),
                    campaignForm.tokenAddress as Address,
                    parseUnits(campaignForm.goal || "0", decimals),
                    deadlineSeconds,
                    campaignForm.payout && isAddressLike(campaignForm.payout) ? (campaignForm.payout as Address) : "0x0000000000000000000000000000000000000000"
                  ]
                });
                const receipt = await publicClient.waitForTransactionReceipt({ hash });
                const event = receipt.logs.find((log) => log.address.toLowerCase() === CONTRACTS.fundingHub.toLowerCase());
                if (event) {
                  try {
                    const parsed = decodeEventLog({
                      abi: FUNDING_HUB_ABI,
                      data: event.data,
                      topics: event.topics
                    });
                    const newCampaign = parsed.args?.campaign as Address | undefined;
                    if (newCampaign) {
                      setCampaignAddress(newCampaign);
                      setPledgeForm((prev) => ({ ...prev, campaign: newCampaign }));
                      setStatus({ message: `Campaign created at ${newCampaign}`, kind: "success", hash });
                    }
                  } catch (error) {
                    setStatus({ message: extractErrorMessage(error), kind: "error", hash });
                  }
                }
                return hash;
              })
            }
            disabled={!account || !isAddressLike(CONTRACTS.fundingHub)}
          >
            Create Campaign
          </button>
          {campaignAddress && <p className="small">Last campaign: {campaignAddress}</p>}
        </fieldset>

        <fieldset>
          <legend>Campaign Actions</legend>
          <label>
            Campaign address
            <input
              value={pledgeForm.campaign}
              onChange={(event) => setPledgeForm((prev) => ({ ...prev, campaign: event.target.value }))}
              placeholder={campaignAddress || "0x…"}
            />
          </label>
          <label>
            Amount
            <input value={pledgeForm.amount} onChange={(event) => setPledgeForm((prev) => ({ ...prev, amount: event.target.value }))} />
          </label>
          <div className="grid">
            <button
              onClick={() => {
                const target = currentCampaignAddress();
                if (!target) {
                  setStatus({ message: "Enter campaign address", kind: "error" });
                  return;
                }
                writeTx("Pledge", () =>
                  walletClient!.writeContract({
                    address: target,
                    abi: TREATMENT_CAMPAIGN_ABI,
                    functionName: "pledge",
                    args: [parseUnits(pledgeForm.amount || "0", decimals)]
                  })
                );
              }}
              disabled={!account}
            >
              Pledge
            </button>
            <button
              className="secondary"
              onClick={() => {
                const target = currentCampaignAddress();
                if (!target) {
                  setStatus({ message: "Enter campaign address", kind: "error" });
                  return;
                }
                writeTx("Unpledge", () =>
                  walletClient!.writeContract({
                    address: target,
                    abi: TREATMENT_CAMPAIGN_ABI,
                    functionName: "unpledge",
                    args: [parseUnits(pledgeForm.amount || "0", decimals)]
                  })
                );
              }}
              disabled={!account}
            >
              Unpledge
            </button>
            <button
              onClick={() => {
                const target = currentCampaignAddress();
                if (!target) {
                  setStatus({ message: "Enter campaign address", kind: "error" });
                  return;
                }
                writeTx("Finalize", () =>
                  walletClient!.writeContract({ address: target, abi: TREATMENT_CAMPAIGN_ABI, functionName: "finalize", args: [] })
                );
              }}
              disabled={!account}
            >
              Finalize
            </button>
            <button
              onClick={() => {
                const target = currentCampaignAddress();
                if (!target) {
                  setStatus({ message: "Enter campaign address", kind: "error" });
                  return;
                }
                writeTx("Withdraw", () =>
                  walletClient!.writeContract({ address: target, abi: TREATMENT_CAMPAIGN_ABI, functionName: "withdraw", args: [] })
                );
              }}
              disabled={!account}
            >
              Withdraw
            </button>
            <button
              className="secondary"
              onClick={() => {
                const target = currentCampaignAddress();
                if (!target) {
                  setStatus({ message: "Enter campaign address", kind: "error" });
                  return;
                }
                writeTx("Claim refund", () =>
                  walletClient!.writeContract({ address: target, abi: TREATMENT_CAMPAIGN_ABI, functionName: "claimRefund", args: [] })
                );
              }}
              disabled={!account}
            >
              Claim Refund
            </button>
          </div>
          <button
            className="secondary"
            onClick={async () => {
              const target = currentCampaignAddress();
              if (!target) {
                setStatus({ message: "Enter campaign address", kind: "error" });
                return;
              }
              const [state, pledged, tokenAddress] = await Promise.all([
                publicClient.readContract({ address: target, abi: TREATMENT_CAMPAIGN_ABI, functionName: "state" }),
                publicClient.readContract({ address: target, abi: TREATMENT_CAMPAIGN_ABI, functionName: "totalPledged" }),
                publicClient.readContract({ address: target, abi: TREATMENT_CAMPAIGN_ABI, functionName: "token" })
              ]);
              setStatus({
                message: `Campaign state: ${state}\nTotal pledged: ${formatUnits(pledged, decimals)}\nToken: ${tokenAddress}`,
                kind: "info"
              });
            }}
          >
            Inspect Campaign
          </button>
        </fieldset>
      </section>

      <section className="section">
        <h2>ZKP Relayer Tools</h2>
        <p className="small">
          Proofs submitted during mint emit events for the off-chain zkVerify relayer. Use these controls with the relayer account to simulate verification.
        </p>
        <fieldset>
          <legend>Relayer Actions</legend>
          <label>
            Proof ID
            <input
              value={relayerForm.proofId}
              onChange={(event) => setRelayerForm((prev) => ({ ...prev, proofId: event.target.value }))}
              placeholder="1"
            />
          </label>
          <label>
            zkVerify submission hash (bytes32, optional)
            <input
              value={relayerForm.submissionId}
              onChange={(event) => setRelayerForm((prev) => ({ ...prev, submissionId: event.target.value }))}
              placeholder="0x..."
            />
          </label>
          <div className="grid">
            <button onClick={markProofVerifiedRelayer} disabled={!account || !isAddressLike(CONTRACTS.zkpVerifier)}>
              Mark Proof Verified
            </button>
            <button
              className="secondary"
              onClick={fetchProofInfo}
              disabled={!isAddressLike(CONTRACTS.zkpVerifier)}
            >
              Fetch Proof Info
            </button>
          </div>
          {proofInfoOutput && <pre>{proofInfoOutput}</pre>}
        </fieldset>
      </section>
    </div>
  );
}
