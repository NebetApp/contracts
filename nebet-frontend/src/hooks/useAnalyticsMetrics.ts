import { useEffect, useMemo, useState } from "react";
import { publicClient } from "../lib/viemClient";
import { CONTRACTS } from "../config";
import { ANALYTICS_ABI } from "../abi";

export type AnalyticsMetrics = {
  totalPassports: bigint;
  verifiedPassports: bigint;
  totalRevenue: bigint;
  lastUpdated: bigint;
};

const DEFAULT_METRICS: AnalyticsMetrics = {
  totalPassports: 0n,
  verifiedPassports: 0n,
  totalRevenue: 0n,
  lastUpdated: 0n
};

export function useAnalyticsMetrics(pollIntervalMs = 15_000) {
  const [metrics, setMetrics] = useState<AnalyticsMetrics>(DEFAULT_METRICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const analyticsAddress = useMemo(() => CONTRACTS.analytics, []);
  const isAnalyticsConfigured = analyticsAddress && analyticsAddress !== "0x0000000000000000000000000000000000000000";

  useEffect(() => {
    if (!isAnalyticsConfigured) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchMetrics = async () => {
      try {
        const result = await publicClient.readContract({
          address: analyticsAddress,
          abi: ANALYTICS_ABI,
          functionName: "getGlobalMetrics"
        });

        if (!cancelled) {
          const [totalPassports, verifiedPassports, totalRevenue, lastUpdated] = result as unknown as [bigint, bigint, bigint, bigint];
          setMetrics({ totalPassports, verifiedPassports, totalRevenue, lastUpdated });
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
          setLoading(false);
        }
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, pollIntervalMs);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [analyticsAddress, isAnalyticsConfigured, pollIntervalMs]);

  return { metrics, loading, error, isAnalyticsConfigured };
}
