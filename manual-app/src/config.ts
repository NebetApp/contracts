import type { Address } from "viem";

export type ContractConfig = {
  accessManager: Address;
  analytics: Address;
  fundingHub: Address;
  healthPassport: Address;
  mockUsdt: Address;
  treatmentImplementation: Address;
  zkpVerifier: Address;
};

export const CONTRACTS: ContractConfig = {
  accessManager: "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512",
  analytics: "0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9",
  fundingHub: "0xa513e6e4b8f2a923d98304ec87f64353c4d5c853",
  healthPassport: "0xdc64a140aa3e981100a9beca4e685f962f0cf6c9",
  mockUsdt: "0x5fbdb2315678afecb367f032d93f642f64180aa3",
  treatmentImplementation: "0x0165878a594ca255338adfa4d48449f69242eb8f",
  zkpVerifier: "0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0"
};
