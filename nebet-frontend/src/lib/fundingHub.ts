import type { Address } from "viem";
import { formatUnits, parseAbiItem } from "viem";
import { CONTRACTS } from "../config";
import { publicClient } from "./viemClient";
import { MOCK_ERC20_ABI, TREATMENT_CAMPAIGN_ABI } from "../abi";

type TokenMetadata = {
  symbol: string;
  decimals: number;
};

export type CampaignState = "active" | "successful" | "failed" | "withdrawn" | "canceled";

export interface FundingCampaign {
  address: Address;
  beneficiary: Address;
  payout: Address;
  token: Address;
  tokenSymbol: string;
  tokenDecimals: number;
  goal: bigint;
  totalPledged: bigint;
  goalFormatted: string;
  pledgedFormatted: string;
  progressPercent: number;
  deadline: Date;
  state: CampaignState;
  isExpired: boolean;
  createdBlock?: bigint;
  transactionHash?: `0x${string}`;
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

const CAMPAIGN_CREATED_EVENT = parseAbiItem(
  "event CampaignCreated(address indexed campaign, address indexed beneficiary, address token, uint256 goal, uint64 deadline, address payout)"
);

const STATE_LABELS: Record<number, CampaignState> = {
  0: "active",
  1: "successful",
  2: "failed",
  3: "withdrawn",
  4: "canceled"
};

export const STATE_PRIORITY: Record<CampaignState, number> = {
  active: 0,
  successful: 1,
  withdrawn: 2,
  failed: 3,
  canceled: 4
};

const tokenMetadataCache = new Map<Address, TokenMetadata>();

function resolveState(value: number | bigint | undefined): CampaignState {
  if (value === undefined) return "active";
  const numeric = typeof value === "bigint" ? Number(value) : value;
  return STATE_LABELS[numeric] ?? "active";
}

function toDate(timestamp: bigint): Date {
  const seconds = Number(timestamp ?? 0n);
  return new Date(seconds * 1000);
}

async function getTokenMetadata(token: Address): Promise<TokenMetadata> {
  const cached = tokenMetadataCache.get(token);
  if (cached) return cached;

  try {
    const responses = await publicClient.multicall({
      allowFailure: true,
      contracts: [
        { address: token, abi: MOCK_ERC20_ABI, functionName: "symbol" },
        { address: token, abi: MOCK_ERC20_ABI, functionName: "decimals" }
      ]
    });

    const symbolResult = responses[0]?.result;
    const decimalsResult = responses[1]?.result;

    const metadata: TokenMetadata = {
      symbol: typeof symbolResult === "string" && symbolResult.length > 0 ? symbolResult : "TOKEN",
      decimals: typeof decimalsResult === "number" ? decimalsResult : Number(decimalsResult ?? 18)
    };

    tokenMetadataCache.set(token, metadata);
    return metadata;
  } catch (error) {
    console.warn("Token metadata multicall failed, falling back", token, error);
    try {
      const [symbol, decimals] = await Promise.all([
        publicClient.readContract({ address: token, abi: MOCK_ERC20_ABI, functionName: "symbol" }) as Promise<string>,
        publicClient.readContract({ address: token, abi: MOCK_ERC20_ABI, functionName: "decimals" }) as Promise<number>
      ]);
      const metadata: TokenMetadata = {
        symbol: symbol && symbol.length > 0 ? symbol : "TOKEN",
        decimals: Number(decimals ?? 18)
      };
      tokenMetadataCache.set(token, metadata);
      return metadata;
    } catch (fallbackError) {
      console.warn("Failed to fetch token metadata", token, fallbackError);
      const fallback = { symbol: "TOKEN", decimals: 18 };
      tokenMetadataCache.set(token, fallback);
      return fallback;
    }
  }
}

async function readCampaignSnapshot(address: Address): Promise<[
  Address,
  Address,
  Address,
  bigint,
  bigint,
  bigint,
  number | bigint
]> {
  try {
    const result = await publicClient.multicall({
      allowFailure: false,
      contracts: [
        { address, abi: TREATMENT_CAMPAIGN_ABI, functionName: "token" },
        { address, abi: TREATMENT_CAMPAIGN_ABI, functionName: "beneficiary" },
        { address, abi: TREATMENT_CAMPAIGN_ABI, functionName: "payout" },
        { address, abi: TREATMENT_CAMPAIGN_ABI, functionName: "goal" },
        { address, abi: TREATMENT_CAMPAIGN_ABI, functionName: "deadline" },
        { address, abi: TREATMENT_CAMPAIGN_ABI, functionName: "totalPledged" },
        { address, abi: TREATMENT_CAMPAIGN_ABI, functionName: "state" }
      ]
    });

    const [
      tokenEntry,
      beneficiaryEntry,
      payoutEntry,
      goalEntry,
      deadlineEntry,
      pledgedEntry,
      stateEntry
    ] = result;

    return [
      tokenEntry?.result as Address,
      beneficiaryEntry?.result as Address,
      (payoutEntry?.result as Address) ?? (beneficiaryEntry?.result as Address),
      (goalEntry?.result as bigint) ?? 0n,
      (deadlineEntry?.result as bigint) ?? 0n,
      (pledgedEntry?.result as bigint) ?? 0n,
      (stateEntry?.result as number | bigint | undefined) ?? 0
    ];
  } catch (error) {
    console.warn("Campaign snapshot multicall failed, falling back", address, error);
    const [token, beneficiary, payout, goal, deadline, totalPledged, state] = await Promise.all([
      publicClient.readContract({ address, abi: TREATMENT_CAMPAIGN_ABI, functionName: "token" }) as Promise<Address>,
      publicClient.readContract({ address, abi: TREATMENT_CAMPAIGN_ABI, functionName: "beneficiary" }) as Promise<Address>,
      publicClient.readContract({ address, abi: TREATMENT_CAMPAIGN_ABI, functionName: "payout" }) as Promise<Address>,
      publicClient.readContract({ address, abi: TREATMENT_CAMPAIGN_ABI, functionName: "goal" }) as Promise<bigint>,
      publicClient.readContract({ address, abi: TREATMENT_CAMPAIGN_ABI, functionName: "deadline" }) as Promise<bigint>,
      publicClient.readContract({ address, abi: TREATMENT_CAMPAIGN_ABI, functionName: "totalPledged" }) as Promise<bigint>,
      publicClient.readContract({ address, abi: TREATMENT_CAMPAIGN_ABI, functionName: "state" }) as Promise<number | bigint>
    ]);

    return [token, beneficiary, payout, goal, deadline, totalPledged, state];
  }
}

export async function loadFundingCampaigns(fundingHubAddress?: Address): Promise<FundingCampaign[]> {
  const targetAddress = fundingHubAddress ?? CONTRACTS.fundingHub;
  if (!targetAddress || targetAddress === ZERO_ADDRESS) {
    return [];
  }

  const logs = await publicClient.getLogs({
    address: targetAddress,
    event: CAMPAIGN_CREATED_EVENT,
    fromBlock: 0n
  });

  const deduped = new Map<string, typeof logs[number]>();
  for (const log of logs) {
    const campaignAddress = log.args?.campaign as Address | undefined;
    if (!campaignAddress) continue;
    deduped.set(campaignAddress.toLowerCase(), log);
  }

  const entries = Array.from(deduped.values());

  const campaigns = await Promise.all(
    entries.map(async (log) => {
      const campaignAddress = log.args?.campaign as Address | undefined;
      if (!campaignAddress) return undefined;

      try {
        const [
          tokenAddress,
          beneficiary,
          payoutRaw,
          goalRaw,
          deadlineRaw,
          pledgedRaw,
          stateRaw
        ] = await readCampaignSnapshot(campaignAddress);

        const tokenMetadata = await getTokenMetadata(tokenAddress);

        const goal = goalRaw ?? 0n;
        const pledged = pledgedRaw ?? 0n;
        const deadlineValue = deadlineRaw ?? 0n;

        const goalFormatted = formatUnits(goal, tokenMetadata.decimals);
        const pledgedFormatted = formatUnits(pledged, tokenMetadata.decimals);

        const progressPercent = goal > 0n ? Number((pledged * 10000n) / goal) / 100 : 0;
        const deadlineDate = toDate(deadlineValue);

        const campaign: FundingCampaign = {
          address: campaignAddress,
          beneficiary,
          payout: payoutRaw ?? beneficiary,
          token: tokenAddress,
          tokenSymbol: tokenMetadata.symbol,
          tokenDecimals: tokenMetadata.decimals,
          goal,
          totalPledged: pledged,
          goalFormatted,
          pledgedFormatted,
          progressPercent: Math.min(Math.max(progressPercent, 0), 100),
          deadline: deadlineDate,
          state: resolveState(stateRaw),
          isExpired: deadlineDate.getTime() < Date.now(),
          createdBlock: log.blockNumber,
          transactionHash: log.transactionHash
        };

        return campaign;
      } catch (innerError) {
        console.warn("Failed to load campaign", campaignAddress, innerError);
        return undefined;
      }
    })
  );

  return campaigns
    .filter((item): item is FundingCampaign => Boolean(item))
    .sort((a, b) => {
      const stateDiff = STATE_PRIORITY[a.state] - STATE_PRIORITY[b.state];
      if (stateDiff !== 0) return stateDiff;
      if (a.state === "active" && b.state === "active") {
        return a.deadline.getTime() - b.deadline.getTime();
      }
      const blockA = a.createdBlock ?? 0n;
      const blockB = b.createdBlock ?? 0n;
      return Number(blockB - blockA);
    });
}
