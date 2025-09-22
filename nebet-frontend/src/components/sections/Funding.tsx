import React, { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "../ui/Table";
import {
  ArrowPathIcon,
  CalendarDaysIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  UserIcon
} from "@heroicons/react/24/outline";
import { formatUnits } from "viem";
import { useFundingCampaigns, FundingCampaign } from "../../hooks/useFundingCampaigns";

function shortenAddress(address: string, chars = 4) {
  if (!address) return "—";
  return `${address.slice(0, 2 + chars)}…${address.slice(-chars)}`;
}

function formatAmount(value: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  if (numeric >= 1000) {
    return numeric.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  return numeric.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatDeadline(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function formatTimeRemaining(deadline: Date) {
  const diffMs = deadline.getTime() - Date.now();
  const isPast = diffMs < 0;
  const absMs = Math.abs(diffMs);
  const days = Math.floor(absMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((absMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((absMs % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return isPast ? `${days}d ${hours}h ago` : `${days}d ${hours}h left`;
  }
  if (hours > 0) {
    return isPast ? `${hours}h ${minutes}m ago` : `${hours}h ${minutes}m left`;
  }
  if (minutes > 0) {
    return isPast ? `${minutes}m ago` : `${minutes}m left`;
  }
  return isPast ? "Expired" : "Less than a minute";
}

function getStatusBadge(campaign: FundingCampaign) {
  const base = campaign.state;
  switch (base) {
    case "active":
      if (campaign.isExpired) {
        return <Badge variant="warning">Awaiting Finalization</Badge>;
      }
      return <Badge variant="info">Active</Badge>;
    case "successful":
      return <Badge variant="success">Successful</Badge>;
    case "failed":
      return <Badge variant="error">Failed</Badge>;
    case "withdrawn":
      return <Badge variant="success">Withdrawn</Badge>;
    case "canceled":
      return <Badge variant="error">Canceled</Badge>;
    default:
      return <Badge>Unknown</Badge>;
  }
}

export const Funding: React.FC = () => {
  const { campaigns, loading, error, refresh, isConfigured } = useFundingCampaigns();

  const summary = useMemo(() => {
    const total = campaigns.length;
    const active = campaigns.filter((c) => c.state === "active").length;
    const expiringSoon = campaigns.filter(
      (c) => c.state === "active" && !c.isExpired && c.deadline.getTime() - Date.now() < 72 * 60 * 60 * 1000
    ).length;
    const uniqueTokens = new Set(campaigns.map((c) => c.token)).size;

    let totalRaisedDisplay = "\u2014";
    let totalGoalDisplay = "\u2014";

    if (campaigns.length > 0) {
      const aggregated = new Map<string, { raised: bigint; goal: bigint; symbol: string; decimals: number }>();
      campaigns.forEach((campaign) => {
        const key = campaign.token.toLowerCase();
        const entry = aggregated.get(key) ?? {
          raised: 0n,
          goal: 0n,
          symbol: campaign.tokenSymbol,
          decimals: campaign.tokenDecimals
        };
        aggregated.set(key, {
          raised: entry.raised + campaign.totalPledged,
          goal: entry.goal + campaign.goal,
          symbol: campaign.tokenSymbol,
          decimals: campaign.tokenDecimals
        });
      });

      if (aggregated.size === 1) {
        const entry = Array.from(aggregated.values())[0];
        totalRaisedDisplay = `${formatAmount(formatUnits(entry.raised, entry.decimals))} ${entry.symbol}`;
        totalGoalDisplay = `${formatAmount(formatUnits(entry.goal, entry.decimals))} ${entry.symbol}`;
      } else {
        totalRaisedDisplay = "Multiple assets";
        totalGoalDisplay = "Multiple assets";
      }
    }

    return { total, active, expiringSoon, uniqueTokens, totalRaisedDisplay, totalGoalDisplay };
  }, [campaigns]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1E2E3F] font-heading">Funding</h1>
          <p className="text-[#8F969C] mt-2 font-body">
            Track treatment campaigns deployed through the FundingHub and monitor their progress.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={refresh} loading={loading}>
          <ArrowPathIcon className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {!isConfigured && (
        <Card variant="bordered">
          <CardHeader>
            <CardTitle>FundingHub not configured</CardTitle>
            <CardDescription>
              Update your environment configuration with a FundingHub contract address to view campaign data.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {error && (
        <Card variant="bordered">
          <CardHeader className="flex-row items-center space-x-3">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
            <div>
              <CardTitle className="text-lg">Unable to load campaigns</CardTitle>
              <CardDescription>{error.message}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" onClick={refresh}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card variant="elevated">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
            <CurrencyDollarIcon className="h-5 w-5 text-[#275365]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#1E2E3F] font-heading">{summary.total}</div>
            <p className="text-xs text-[#8F969C] font-body mt-1">All-time created campaigns</p>
            <p className="text-xs text-[#8F969C] font-body">Raised: {summary.totalRaisedDisplay}</p>
            <p className="text-xs text-[#8F969C] font-body">Aggregate goal: {summary.totalGoalDisplay}</p>
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <UserIcon className="h-5 w-5 text-[#275365]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#1E2E3F] font-heading">{summary.active}</div>
            <p className="text-xs text-[#8F969C] font-body mt-1">Currently raising funds</p>
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <CalendarDaysIcon className="h-5 w-5 text-[#275365]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#1E2E3F] font-heading">{summary.expiringSoon}</div>
            <p className="text-xs text-[#8F969C] font-body mt-1">Within the next 72 hours</p>
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Funding Assets</CardTitle>
            <CurrencyDollarIcon className="h-5 w-5 text-[#275365]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#1E2E3F] font-heading">{summary.uniqueTokens}</div>
            <p className="text-xs text-[#8F969C] font-body mt-1">Unique ERC20 tokens used</p>
          </CardContent>
        </Card>
      </div>

      <Card variant="elevated">
        <CardHeader>
          <CardTitle>Campaigns</CardTitle>
          <CardDescription>Funding progress and deadlines for each treatment campaign.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && campaigns.length === 0 && (
            <div className="py-10 text-center text-[#8F969C] font-body">Loading campaigns…</div>
          )}

          {!loading && campaigns.length === 0 && (
            <div className="py-10 text-center text-[#8F969C] font-body">
              No campaigns have been created yet. Deploy a treatment campaign via the FundingHub to see it listed here.
            </div>
          )}

          {campaigns.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Funding</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => {
                  const progress = Math.max(0, Math.min(100, Number.isFinite(campaign.progressPercent) ? campaign.progressPercent : 0));
                  return (
                    <TableRow key={campaign.address}>
                      <TableCell>
                        <div className="flex flex-col space-y-1">
                          <span className="text-sm font-medium text-[#1E2E3F] font-body">
                            Beneficiary: {shortenAddress(campaign.beneficiary)}
                          </span>
                          <span className="text-xs text-[#8F969C] font-mono">{shortenAddress(campaign.address, 6)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <div className="text-sm font-semibold text-[#1E2E3F] font-body">
                            {formatAmount(campaign.pledgedFormatted)} {campaign.tokenSymbol}
                          </div>
                          <div className="text-xs text-[#8F969C] font-body">
                            Goal: {formatAmount(campaign.goalFormatted)} {campaign.tokenSymbol}
                          </div>
                          <div className="h-2 w-full rounded-full bg-[#8F969C]/20 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#275365] to-[#3B7F9F]"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm font-body">
                          <div className="text-[#1E2E3F]">{formatDeadline(campaign.deadline)}</div>
                          <div className="text-xs text-[#8F969C]">
                            {formatTimeRemaining(campaign.deadline)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="space-y-2">
                        {getStatusBadge(campaign)}
                        <div className="text-xs text-[#8F969C] font-mono">
                          {campaign.state.charAt(0).toUpperCase() + campaign.state.slice(1)}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
