import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Address, WalletClient, createWalletClient, custom, formatUnits, toHex } from "viem";

import { CONTRACTS, NETWORK_CHAIN, NETWORK_LABEL } from "../config";
import { publicClient } from "../lib/viemClient";
import { MOCK_ERC20_ABI } from "../abi";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const USDT_DECIMALS = 6;

export interface WalletContextValue {
  account?: Address;
  walletClient?: WalletClient;
  chainId?: number;
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
  usdtBalance: bigint;
  formattedUsdtBalance: string;
  networkLabel: string;
  isCorrectNetwork: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchToConfiguredNetwork: () => Promise<void>;
  refreshBalances: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

async function detectExistingAccount(): Promise<Address | undefined> {
  const provider = window.ethereum;
  if (!provider) return undefined;
  try {
    const accounts = await provider.request({ method: "eth_accounts" });
    if (Array.isArray(accounts) && accounts.length > 0) {
      return accounts[0] as Address;
    }
  } catch (error) {
    console.warn("Failed to detect existing wallet account", error);
  }
  return undefined;
}

function buildWalletClient(account: Address) {
  const provider = window.ethereum;
  if (!provider) return undefined;
  return createWalletClient({
    account,
    chain: NETWORK_CHAIN,
    transport: custom(provider)
  });
}

export const WalletProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [account, setAccount] = useState<Address | undefined>(undefined);
  const [walletClient, setWalletClient] = useState<WalletClient | undefined>(undefined);
  const [chainId, setChainId] = useState<number | undefined>(undefined);
  const [usdtBalance, setUsdtBalance] = useState<bigint>(0n);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const usdtConfigured = useMemo(() => CONTRACTS.mockUsdt !== ZERO_ADDRESS, []);

  const refreshBalances = useCallback(async () => {
    if (!account || !usdtConfigured) return;
    try {
      const balance = await publicClient.readContract({
        address: CONTRACTS.mockUsdt,
        abi: MOCK_ERC20_ABI,
        functionName: "balanceOf",
        args: [account]
      });
      setUsdtBalance(balance as bigint);
    } catch (err) {
      console.warn("Failed to read USDT balance", err);
    }
  }, [account, usdtConfigured]);

  const connect = useCallback(async () => {
    const provider = window.ethereum;
    if (!provider) {
      setError(new Error("No Ethereum provider detected. Install MetaMask or a compatible wallet."));
      return;
    }

    setIsConnecting(true);
    setError(null);
    try {
      const accounts = await provider.request({ method: "eth_requestAccounts" });
      if (!Array.isArray(accounts) || accounts.length === 0) {
        throw new Error("No accounts returned by wallet");
      }

      const nextAccount = accounts[0] as Address;
      const client = buildWalletClient(nextAccount);
      if (!client) {
        throw new Error("Failed to create wallet client");
      }

      const currentChainId = await client.getChainId();

      setAccount(nextAccount);
      setWalletClient(client);
      setChainId(currentChainId);

      await refreshBalances();
    } catch (err) {
      setError(err as Error);
      setAccount(undefined);
      setWalletClient(undefined);
      setChainId(undefined);
      setUsdtBalance(0n);
    } finally {
      setIsConnecting(false);
    }
  }, [refreshBalances]);

  const disconnect = useCallback(() => {
    setAccount(undefined);
    setWalletClient(undefined);
    setChainId(undefined);
    setUsdtBalance(0n);
    setError(null);
  }, []);

  const switchToConfiguredNetwork = useCallback(async () => {
    const provider = window.ethereum;
    if (!provider) return;
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: toHex(NETWORK_CHAIN.id) }]
      });
    } catch (switchError: any) {
      if (switchError?.code === 4902 && NETWORK_CHAIN?.rpcUrls?.default?.http?.length) {
        try {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: toHex(NETWORK_CHAIN.id),
                chainName: NETWORK_CHAIN.name,
                rpcUrls: NETWORK_CHAIN.rpcUrls.default.http,
                nativeCurrency: NETWORK_CHAIN.nativeCurrency,
                blockExplorerUrls: NETWORK_CHAIN.blockExplorers?.default ? [NETWORK_CHAIN.blockExplorers.default.url] : undefined
              }
            ]
          });
        } catch (addError) {
          setError(addError as Error);
        }
      } else {
        setError(switchError as Error);
      }
    }
  }, []);

  useEffect(() => {
    (async () => {
      const existing = await detectExistingAccount();
      if (existing) {
        const client = buildWalletClient(existing);
        setAccount(existing);
        setWalletClient(client);
        if (client) {
          const id = await client.getChainId();
          setChainId(id);
        }
        refreshBalances();
      }
    })();
  }, [refreshBalances]);

  useEffect(() => {
    const provider = window.ethereum;
    if (!provider?.on) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (!accounts || accounts.length === 0) {
        disconnect();
      } else {
        const nextAccount = accounts[0] as Address;
        setAccount(nextAccount);
        const client = buildWalletClient(nextAccount);
        setWalletClient(client);
        refreshBalances();
      }
    };

    const handleChainChanged = (hexChainId: string) => {
      const parsed = Number.parseInt(hexChainId, 16);
      setChainId(parsed);
      refreshBalances();
    };

    provider.on("accountsChanged", handleAccountsChanged);
    provider.on("chainChanged", handleChainChanged);

    return () => {
      provider.removeListener?.("accountsChanged", handleAccountsChanged);
      provider.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [disconnect, refreshBalances]);

  useEffect(() => {
    if (!account) return;
    const interval = setInterval(() => {
      refreshBalances();
    }, 15_000);
    return () => clearInterval(interval);
  }, [account, refreshBalances]);

  const isConnected = Boolean(account && walletClient);
  const isCorrectNetwork = !chainId || chainId === NETWORK_CHAIN.id;

  const formattedUsdtBalance = useMemo(() => {
    if (!isConnected) return "0.00";
    return Number.parseFloat(formatUnits(usdtBalance, USDT_DECIMALS)).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }, [isConnected, usdtBalance]);

  const value: WalletContextValue = {
    account,
    walletClient,
    chainId,
    isConnected,
    isConnecting,
    error,
    usdtBalance,
    formattedUsdtBalance,
    networkLabel: NETWORK_LABEL,
    isCorrectNetwork,
    connect,
    disconnect,
    switchToConfiguredNetwork,
    refreshBalances
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
