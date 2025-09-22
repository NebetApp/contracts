import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Address } from "viem";
import { CONTRACTS } from "../config";
import { loadFundingCampaigns, FundingCampaign } from "../lib/fundingHub";

export type { FundingCampaign, CampaignState } from "../lib/fundingHub";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

type FetchOptions = {
  showLoading?: boolean;
};

export function useFundingCampaigns(pollIntervalMs = 15_000) {
  const [campaigns, setCampaigns] = useState<FundingCampaign[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fundingHubAddress = useMemo(() => CONTRACTS.fundingHub, []);
  const isConfigured = fundingHubAddress !== ZERO_ADDRESS;

  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchCampaigns = useCallback(
    async ({ showLoading = true }: FetchOptions = {}) => {
      if (!isConfigured) {
        if (isMountedRef.current) {
          setCampaigns([]);
          setLoading(false);
          setError(null);
        }
        return;
      }

      if (isMountedRef.current && showLoading) {
        setLoading(true);
      }

      try {
        const data = await loadFundingCampaigns(fundingHubAddress as Address);
        if (!isMountedRef.current) return;
        setCampaigns(data);
        setError(null);
      } catch (err) {
        if (!isMountedRef.current) return;
        setError(err as Error);
      } finally {
        if (isMountedRef.current && showLoading) {
          setLoading(false);
        }
      }
    },
    [fundingHubAddress, isConfigured]
  );

  useEffect(() => {
    fetchCampaigns({ showLoading: true });
    if (!isConfigured) return;

    const interval = setInterval(() => {
      fetchCampaigns({ showLoading: false });
    }, pollIntervalMs);

    return () => {
      clearInterval(interval);
    };
  }, [fetchCampaigns, isConfigured, pollIntervalMs]);

  const refresh = useCallback(() => {
    fetchCampaigns({ showLoading: true });
  }, [fetchCampaigns]);

  return {
    campaigns,
    loading,
    error,
    refresh,
    isConfigured
  };
}
