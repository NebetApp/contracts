import { useCallback, useEffect, useMemo, useState } from "react";
import { Address } from "viem";
import { publicClient } from "../lib/viemClient";
import { CONTRACTS } from "../config";
import { HEALTH_PASSPORT_ABI } from "../abi";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export type PassportStatus = "none" | "pending" | "verified" | "rejected" | "revoked";

export type StoredProof = {
  proofId: bigint;
  category: number;
  value: bigint;
  verified: boolean;
};

export type PassportRecord = {
  tokenId: bigint;
  owner: Address;
  status: PassportStatus;
  createdAt: Date;
  updatedAt: Date;
  lastVerifier: Address | null;
  verificationURI?: string;
  dataURI: string;
  metadata?: PassportMetadata;
  proofs: StoredProof[];
  userData: Record<EncryptedFieldKey, string>;
};

export type EncryptedFieldKey =
  | "encryptedName"
  | "encryptedBirthDate"
  | "encryptedNationality"
  | "encryptedVaccines"
  | "encryptedMedications"
  | "encryptedAllergies"
  | "encryptedTreatments";

export type PassportMetadata = {
  name?: string;
  description?: string;
  image?: string;
  raw?: any;
};

const STATUS_MAP: Record<number, PassportStatus> = {
  0: "none",
  1: "pending",
  2: "verified",
  3: "rejected",
  4: "revoked"
};

function resolveStatus(value: number): PassportStatus {
  return STATUS_MAP[value] ?? "none";
}

function resolveUri(uri: string): string {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${uri.slice("ipfs://".length)}`;
  }
  return uri;
}

async function fetchMetadata(uri: string): Promise<PassportMetadata | undefined> {
  if (!uri) return undefined;
  try {
    const response = await fetch(resolveUri(uri));
    if (!response.ok) return undefined;
    const json = await response.json();
    return {
      name: json.name,
      description: json.description,
      image: json.image ? resolveUri(json.image) : undefined,
      raw: json
    };
  } catch (error) {
    console.warn("Failed to fetch metadata", error);
    return undefined;
  }
}

export function usePassports(account?: Address, totalPassports?: number, pollIntervalMs = 20_000) {
  const [passports, setPassports] = useState<PassportRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const healthPassportAddress = useMemo(() => CONTRACTS.healthPassport, []);
  const isConfigured = healthPassportAddress !== ZERO_ADDRESS;

  const fetchPassports = useCallback(async () => {
    if (!account || !isConfigured) {
      setPassports([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const activeAccount = account as Address;
      const totalToScan = Math.min(totalPassports ?? 0, 200);
      const start = Math.max(1, (totalPassports ?? 0) - totalToScan + 1);
      const ownedTokenIds: bigint[] = [];

      for (let tokenId = start; tokenId <= (totalPassports ?? 0); tokenId++) {
        try {
          const result = await publicClient.readContract({
            address: healthPassportAddress,
            abi: HEALTH_PASSPORT_ABI,
            functionName: "passportOf",
            args: [BigInt(tokenId)]
          });
          const [owner] = result as unknown as [Address, string, string, bigint, bigint, number, Address, string];
          if (owner.toLowerCase() === activeAccount.toLowerCase()) {
            ownedTokenIds.push(BigInt(tokenId));
          }
        } catch (innerError) {
          // Ignore gaps / unminted IDs
        }
      }

      if (ownedTokenIds.length === 0) {
        setPassports([]);
        setLoading(false);
        return;
      }

      const results = await Promise.all(
        ownedTokenIds.map(async (tokenId) => {
          const [passportTuple, proofTuple, tokenUri] = await Promise.all([
            publicClient.readContract({
              address: healthPassportAddress,
              abi: HEALTH_PASSPORT_ABI,
              functionName: "passportOf",
              args: [tokenId]
            }),
            publicClient.readContract({
              address: healthPassportAddress,
              abi: HEALTH_PASSPORT_ABI,
              functionName: "getProofRecords",
              args: [tokenId]
            }),
            publicClient.readContract({
              address: healthPassportAddress,
              abi: HEALTH_PASSPORT_ABI,
              functionName: "tokenURI",
              args: [tokenId]
            })
          ]);

          const [owner, dataURI, , createdAt, updatedAt, rawStatus, lastVerifier, verificationURI] = passportTuple as unknown as [
            Address,
            string,
            string,
            bigint,
            bigint,
            number,
            Address,
            string
          ];

          const [proofIds, categories, values, verifiedFlags] = proofTuple as unknown as [bigint[], number[], bigint[], boolean[]];

          const proofs: StoredProof[] = proofIds.map((proofId, index) => ({
            proofId,
            category: Number(categories[index] ?? 0),
            value: values[index] ?? 0n,
            verified: Boolean(verifiedFlags[index])
          }));

          const metadata = await fetchMetadata(tokenUri as unknown as string);

          let userDataArray: [string, string, string, string, string, string, string] = ["", "", "", "", "", "", ""];
          try {
            const tuple = await publicClient.readContract({
              address: healthPassportAddress,
              abi: HEALTH_PASSPORT_ABI,
              functionName: "getUserData",
              args: [tokenId],
              account: activeAccount
            });
            userDataArray = tuple as unknown as [string, string, string, string, string, string, string];
          } catch (readError) {
            console.warn("Failed to read user data for token", tokenId.toString(), readError);
          }

          const userData: Record<EncryptedFieldKey, string> = {
            encryptedName: userDataArray[0] ?? "",
            encryptedBirthDate: userDataArray[1] ?? "",
            encryptedNationality: userDataArray[2] ?? "",
            encryptedVaccines: userDataArray[3] ?? "",
            encryptedMedications: userDataArray[4] ?? "",
            encryptedAllergies: userDataArray[5] ?? "",
            encryptedTreatments: userDataArray[6] ?? ""
          };

          return {
            tokenId,
            owner,
            status: resolveStatus(Number(rawStatus)),
            createdAt: new Date(Number(createdAt) * 1000),
            updatedAt: new Date(Number(updatedAt) * 1000),
            lastVerifier: lastVerifier === ZERO_ADDRESS ? null : lastVerifier,
            verificationURI,
            dataURI,
            metadata,
            proofs,
            userData
          } satisfies PassportRecord;
        })
      );

      setPassports(results.filter(Boolean) as PassportRecord[]);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [account, healthPassportAddress, isConfigured, totalPassports]);

  useEffect(() => {
    if (!account || !isConfigured || !totalPassports || totalPassports <= 0) {
      setPassports([]);
      setLoading(false);
      return;
    }

    fetchPassports();
    const interval = setInterval(fetchPassports, pollIntervalMs);
    return () => clearInterval(interval);
  }, [account, fetchPassports, isConfigured, pollIntervalMs]);

  return { passports, loading, error, refresh: fetchPassports };
}
