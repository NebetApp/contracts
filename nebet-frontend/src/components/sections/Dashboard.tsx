import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import {
  ShieldCheckIcon,
  HeartIcon,
  ChartBarIcon,
  CloudIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

import { useAnalyticsMetrics } from '../../hooks/useAnalyticsMetrics';

const mockStats = {
  totalFunding: 156780,
  activeCampaigns: 23,
  pendingVerifications: 12,
  relayerStatus: 'active',
  recentActivity: [
    { type: 'passport_minted', user: '0x1234...5678', timestamp: '2 minutes ago' },
    { type: 'verification_approved', tokenId: '#127', timestamp: '5 minutes ago' },
    { type: 'campaign_funded', amount: 500, timestamp: '12 minutes ago' },
    { type: 'proof_verified', proofId: '#89', timestamp: '18 minutes ago' },
  ]
};

export const Dashboard: React.FC = () => {
  const { metrics, loading, error } = useAnalyticsMetrics();

  const totalPassports = Number(metrics.totalPassports);
  const verifiedPassports = Number(metrics.verifiedPassports);
  const verificationRate = totalPassports > 0 ? Math.round((verifiedPassports / totalPassports) * 100) : 0;

  const formatNumber = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1E2E3F] font-heading">
          Dashboard
        </h1>
        <p className="text-[#8F969C] mt-2 font-body">
          Overview of your Nebet health passport ecosystem
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card variant="elevated">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Passports</CardTitle>
              <ShieldCheckIcon className="h-4 w-4 text-[#275365]" />
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-2xl font-bold text-[#1E2E3F] font-heading">
                {loading ? 'Loading…' : formatNumber(totalPassports)}
              </div>
              {error ? (
                <p className="text-xs text-red-500 font-body">Unable to load metrics</p>
              ) : (
                <p className="text-xs text-[#8F969C] font-body">
                  Updated automatically every 15 seconds
                </p>
              )}
            </CardContent>
          </Card>

          <Card variant="elevated">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Verified Passports</CardTitle>
              <CheckCircleIcon className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-2xl font-bold text-[#1E2E3F] font-heading">
                {loading ? '—' : formatNumber(verifiedPassports)}
              </div>
              <p className="text-xs text-[#8F969C] font-body">
                {loading ? 'Calculating...' : `${verificationRate}% verification rate`}
              </p>
            </CardContent>
          </Card>

        <Card variant="elevated">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Funding</CardTitle>
            <CurrencyDollarIcon className="h-4 w-4 text-[#275365]" />
          </CardHeader>
          <CardContent className='text-center'>
            <div className="text-2xl font-bold text-[#1E2E3F] font-heading">
              ${mockStats.totalFunding.toLocaleString()}
            </div>
            <p className="text-xs text-[#8F969C] font-body">
              Across {mockStats.activeCampaigns} active campaigns
            </p>
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Relayer Status</CardTitle>
            <CloudIcon className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent className='text-center'>
            <div className="flex items-center justify-center space-x-2">
              <Badge variant="success">Active</Badge>
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            </div>
            <p className="text-xs text-[#8F969C] font-body mt-2">
              Processing proofs normally
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Activity */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest platform events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockStats.recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center space-x-4 p-3 rounded-lg bg-white border border-[#8F969C]/10">
                  <div className="flex-shrink-0">
                    {activity.type === 'passport_minted' && (
                      <div className="w-8 h-8 bg-[#275365]/10 rounded-full flex items-center justify-center">
                        <ShieldCheckIcon className="h-4 w-4 text-[#275365]" />
                      </div>
                    )}
                    {activity.type === 'verification_approved' && (
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircleIcon className="h-4 w-4 text-green-600" />
                      </div>
                    )}
                    {activity.type === 'campaign_funded' && (
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <HeartIcon className="h-4 w-4 text-blue-600" />
                      </div>
                    )}
                    {activity.type === 'proof_verified' && (
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <CloudIcon className="h-4 w-4 text-purple-600" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1E2E3F] font-body">
                      {activity.type === 'passport_minted' && `Passport minted by ${activity.user}`}
                      {activity.type === 'verification_approved' && `Passport ${activity.tokenId} verified`}
                      {activity.type === 'campaign_funded' && `Campaign received $${activity.amount} funding`}
                      {activity.type === 'proof_verified' && `ZKP ${activity.proofId} verified by relayer`}
                    </p>
                    <p className="text-xs text-[#8F969C] font-body">
                      {activity.timestamp}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button className="p-4 rounded-lg border border-[#8F969C]/20 hover:border-[#275365] hover:bg-[#275365]/5 transition-all duration-200 text-left">
                <ShieldCheckIcon className="h-6 w-6 text-[#275365] mb-2" />
                <h3 className="font-medium text-[#1E2E3F] font-body">Mint Passport</h3>
                <p className="text-sm text-[#8F969C] mt-1 font-body">Create new health passport</p>
              </button>
              
              <button className="p-4 rounded-lg border border-[#8F969C]/20 hover:border-[#275365] hover:bg-[#275365]/5 transition-all duration-200 text-left">
                <ClockIcon className="h-6 w-6 text-yellow-600 mb-2" />
                <h3 className="font-medium text-[#1E2E3F] font-body">Pending Reviews</h3>
                <p className="text-sm text-[#8F969C] mt-1 font-body">{mockStats.pendingVerifications} awaiting verification</p>
              </button>
              
              <button className="p-4 rounded-lg border border-[#8F969C]/20 hover:border-[#275365] hover:bg-[#275365]/5 transition-all duration-200 text-left">
                <HeartIcon className="h-6 w-6 text-red-600 mb-2" />
                <h3 className="font-medium text-[#1E2E3F] font-body">Create Campaign</h3>
                <p className="text-sm text-[#8F969C] mt-1 font-body">Start treatment funding</p>
              </button>
              
              <button className="p-4 rounded-lg border border-[#8F969C]/20 hover:border-[#275365] hover:bg-[#275365]/5 transition-all duration-200 text-left">
                <ChartBarIcon className="h-6 w-6 text-[#275365] mb-2" />
                <h3 className="font-medium text-[#1E2E3F] font-body">Analytics</h3>
                <p className="text-sm text-[#8F969C] mt-1 font-body">View platform insights</p>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Network Status */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Network Status</CardTitle>
          <CardDescription>Base Sepolia testnet information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4">
              <div className="text-2xl font-bold text-[#1E2E3F] font-heading">Base Sepolia</div>
              <p className="text-sm text-[#8F969C] font-body">Test Network</p>
              <Badge variant="success" className="mt-2">Connected</Badge>
            </div>
            
            <div className="text-center p-4">
              <div className="text-2xl font-bold text-[#1E2E3F] font-heading">~2s</div>
              <p className="text-sm text-[#8F969C] font-body">Block Time</p>
              <Badge variant="info" className="mt-2">Optimal</Badge>
            </div>
            
            <div className="text-center p-4">
              <div className="text-2xl font-bold text-[#1E2E3F] font-heading">0.001 ETH</div>
              <p className="text-sm text-[#8F969C] font-body">Gas Price</p>
              <Badge variant="success" className="mt-2">Low</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
