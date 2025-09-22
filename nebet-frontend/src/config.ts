import type { Address, Chain } from "viem";
import { baseSepolia, hardhat } from "viem/chains";

export type ContractConfig = {
  accessManager: Address;
  analytics: Address;
  fundingHub: Address;
  healthPassport: Address;
  mockUsdt: Address;
  treatmentImplementation: Address;
  zkpVerifier: Address;
};

type NetworkKey = "local" | "baseSepolia";

type NetworkConfig = {
  label: string;
  chain: Chain;
  rpcUrl: string;
  contracts: ContractConfig;
};

const ZERO: Address = "0x0000000000000000000000000000000000000000";

const NETWORKS: Record<NetworkKey, NetworkConfig> = {
  local: {
    label: "Hardhat Localhost",
    chain: hardhat,
    rpcUrl: "http://127.0.0.1:8545",
    contracts: {
      accessManager: "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512",
      analytics: "0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9",
      fundingHub: "0xa513e6e4b8f2a923d98304ec87f64353c4d5c853",
      healthPassport: "0xdc64a140aa3e981100a9beca4e685f962f0cf6c9",
      mockUsdt: "0x5fbdb2315678afecb367f032d93f642f64180aa3",
      treatmentImplementation: "0x0165878a594ca255338adfa4d48449f69242eb8f",
      zkpVerifier: "0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0"
    }
  },
  baseSepolia: {
    label: "Base Sepolia",
    chain: baseSepolia,
    rpcUrl: "https://base-sepolia.g.alchemy.com/v2/_IKasD09mOWTR3Fs50avdymLR7dPy2-7",
    contracts: {
      accessManager: "0xc77f4d729d3b7f871d160e94828986341dd6c13f",
      analytics: "0xc638f354cb01f497ff16e7784d7731262727e209",
      fundingHub: "0xd91d12868043fda21bce7f4197ad5dbdd581f645",
      healthPassport: "0x0cc8beed92d1e39fb951ab5796ef11243452de0f",
      mockUsdt: "0x999e1c5fe5609a3f228b8b5e0ac3c4dc848b6623",
      treatmentImplementation: "0x4f8507e6b2d5cad7ef9893836228328ea9f426d0",
      zkpVerifier: "0xae36d4a13ed9f0edf3e9151faa042153e7bf3596"
    }
  }
};

const activeNetworkKey = (import.meta.env.VITE_NETWORK as NetworkKey | undefined) ?? "local";

if (!(activeNetworkKey in NETWORKS)) {
  throw new Error(`Unsupported network "${activeNetworkKey}". Set VITE_NETWORK to one of: ${Object.keys(NETWORKS).join(", ")}.`);
}

export const NETWORK_KEY = activeNetworkKey;
export const NETWORK_CONFIG = NETWORKS[NETWORK_KEY];
export const CONTRACTS = NETWORK_CONFIG.contracts;
const resolvedRpcUrl = import.meta.env.VITE_RPC_URL ?? NETWORK_CONFIG.rpcUrl;
if (!resolvedRpcUrl) {
  throw new Error(
    `Missing RPC URL for ${NETWORK_CONFIG.label}. Set VITE_RPC_URL in your environment when building the manual app.`
  );
}
export const RPC_URL = resolvedRpcUrl;
export const NETWORK_LABEL = NETWORK_CONFIG.label;
export const NETWORK_CHAIN = NETWORK_CONFIG.chain;
export const AVAILABLE_NETWORKS = Object.keys(NETWORKS) as NetworkKey[];
