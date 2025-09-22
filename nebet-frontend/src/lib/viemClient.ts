import { createPublicClient, http } from "viem";
import { NETWORK_CHAIN, RPC_URL } from "../config";

export const publicClient = createPublicClient({
  chain: NETWORK_CHAIN,
  transport: http(RPC_URL)
});
