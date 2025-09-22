import React, { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { 
  ShieldCheckIcon, 
  HeartIcon, 
  ChartBarIcon, 
  CloudIcon,
  Bars3Icon,
  XMarkIcon,
  WalletIcon,
  CheckBadgeIcon
} from '@heroicons/react/24/outline';
import { Button } from '../ui/Button';
import { useWallet } from '../../wallet/WalletProvider';

const navigation = [
  { name: 'Dashboard', href: '#dashboard', icon: ChartBarIcon },
  { name: 'Passports', href: '#passports', icon: ShieldCheckIcon },
  { name: 'Verification', href: '#verification', icon: CheckBadgeIcon },
  { name: 'Funding', href: '#funding', icon: HeartIcon },
  { name: 'Analytics', href: '#analytics', icon: ChartBarIcon },
  { name: 'Relayer', href: '#relayer', icon: CloudIcon },
];

export interface NavigationProps {
  currentSection: string;
  onSectionChange: (section: string) => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentSection,
  onSectionChange
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const {
    account,
    isConnected,
    isConnecting,
    formattedUsdtBalance,
    networkLabel,
    isCorrectNetwork,
    switchToConfiguredNetwork,
    connect,
    error
  } = useWallet();

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const connectionDescription = useMemo(() => {
    if (!isConnected) return 'Wallet disconnected';
    if (!isCorrectNetwork) return 'Wrong network';
    return networkLabel;
  }, [isConnected, isCorrectNetwork, networkLabel]);

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-gradient-to-b from-[#1E2E3F] to-[#223A4E] border-r border-[#275365]/20">
        <div className="flex flex-col flex-1 pt-8 pb-4">
          {/* Logo */}
          <div className="flex items-center flex-shrink-0 px-6">
            <ShieldCheckIcon className="h-8 w-8 text-[#275365]" />
            <span className="ml-3 text-xl font-bold text-white font-heading">
              Nebet
            </span>
          </div>

          {/* Navigation Items */}
          <nav className="mt-8 flex-1 px-4 space-y-1">
            {navigation.map((item) => (
              <button
                key={item.name}
                onClick={() => onSectionChange(item.name.toLowerCase())}
                className={clsx(
                  'group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 w-full text-left font-body',
                  currentSection === item.name.toLowerCase()
                    ? 'bg-[#275365] text-white shadow-md'
                    : 'text-gray-300 hover:bg-[#275365]/50 hover:text-white'
                )}
              >
                <item.icon
                  className={clsx(
                    'mr-3 h-5 w-5 transition-colors',
                    currentSection === item.name.toLowerCase()
                      ? 'text-white'
                      : 'text-gray-400 group-hover:text-white'
                  )}
                />
                {item.name}
              </button>
            ))}
          </nav>

          {/* Connection Status */}
          <div className="px-4">
            {isConnected ? (
              <div className="space-y-3">
                <div className="px-3 py-2 rounded-lg bg-[#275365]/20 border border-[#275365]/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-300 font-body">Connected</span>
                    <div className="flex items-center">
                      <div className={clsx('w-2 h-2 rounded-full mr-2', isCorrectNetwork ? 'bg-green-400' : 'bg-yellow-400 animate-pulse')}></div>
                      <span className="text-xs text-white font-body">{connectionDescription}</span>
                    </div>
                  </div>
                  <p className="text-xs text-white font-mono mt-1">
                    {account && formatAddress(account)}
                  </p>
                  <p className="text-xs text-gray-300 font-body mt-1">
                    Balance: {formattedUsdtBalance} USDT
                  </p>
                  {!isCorrectNetwork && (
                    <p className="text-xs text-gray-300 font-body mt-1">
                      <Button
                        variant="ghost"
                        size="xs"
                        className="mt-2"
                        onClick={switchToConfiguredNetwork}
                      >
                        Switch to {networkLabel}
                      </Button>
                    </p>
                  )}
                </div>
                {error && (
                  <p className="text-xs text-red-400 font-body">{error.message}</p>
                )}
              </div>
            ) : (
              <Button
                onClick={connect}
                variant="primary"
                size="sm"
                className="w-full"
                pill
                disabled={isConnecting}
              >
                <WalletIcon className="h-4 w-4 mr-2" />
                {isConnecting ? 'Connecting…' : 'Connect Wallet'}
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <div className="lg:hidden">
        {/* Mobile Header */}
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-[#1E2E3F] to-[#223A4E] border-b border-[#275365]/20">
          <div className="flex items-center">
            <ShieldCheckIcon className="h-6 w-6 text-[#275365]" />
            <span className="ml-2 text-lg font-bold text-white font-heading">
              Nebet
            </span>
          </div>
          
          <div className="flex items-center space-x-3">
            {!isConnected && (
              <Button
                onClick={connect}
                variant="primary"
                size="sm"
                pill
                disabled={isConnecting}
              >
                <WalletIcon className="h-4 w-4" />
              </Button>
            )}
            
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-white p-1"
            >
              {mobileMenuOpen ? (
                <XMarkIcon className="h-6 w-6" />
              ) : (
                <Bars3Icon className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="bg-gradient-to-b from-[#1E2E3F] to-[#223A4E] border-b border-[#275365]/20">
            <nav className="px-4 py-4 space-y-1">
              {navigation.map((item) => (
                <button
                  key={item.name}
                  onClick={() => {
                    onSectionChange(item.name.toLowerCase());
                    setMobileMenuOpen(false);
                  }}
                  className={clsx(
                    'group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 w-full text-left font-body',
                    currentSection === item.name.toLowerCase()
                      ? 'bg-[#275365] text-white shadow-md'
                      : 'text-gray-300 hover:bg-[#275365]/50 hover:text-white'
                  )}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.name}
                </button>
              ))}
            </nav>
            
            {/* Mobile Connection Status */}
            {isConnected && (
              <div className="px-4 pb-4">
                <div className="px-3 py-2 rounded-lg bg-[#275365]/20 border border-[#275365]/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-300 font-body">Connected</span>
                    <div className="flex items-center">
                      <div className={clsx('w-2 h-2 rounded-full mr-2', isCorrectNetwork ? 'bg-green-400' : 'bg-yellow-400 animate-pulse')}></div>
                      <span className="text-xs text-white font-body">{connectionDescription}</span>
                    </div>
                  </div>
                  <p className="text-xs text-white font-mono mt-1">
                    {account && formatAddress(account)}
                  </p>
                  <p className="text-xs text-gray-300 font-body mt-1">
                    Balance: {formattedUsdtBalance} USDT
                  </p>
                  {!isCorrectNetwork && (
                    <Button
                      variant="ghost"
                      size="xs"
                      className="mt-2"
                      onClick={() => {
                        switchToConfiguredNetwork();
                        setMobileMenuOpen(false);
                      }}
                    >
                      Switch to {networkLabel}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};
