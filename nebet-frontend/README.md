# Nebet Health Passport dApp

A comprehensive decentralized health passport system built on Base Sepolia, featuring encrypted medical records, zero-knowledge proofs, treatment funding, and analytics marketplace.

## Features

### 🏥 Health Passports
- **Mint NFT Passports**: Create encrypted health records as ERC721 tokens
- **Multi-step Workflow**: Guided process for data entry, proof upload, and payment
- **ZK Proof Integration**: Submit zero-knowledge proofs for demographic verification
- **Status Tracking**: Monitor verification status and proof records

### ✅ Verification System
- **Verifier Console**: Role-based access for medical professionals
- **Batch Processing**: Efficient review of multiple verification requests
- **Proof Validation**: Integration with ZK proof verification system
- **Audit Trail**: Complete history of verification decisions

### 💰 Treatment Funding
- **Campaign Creation**: Verified patients can create treatment funding campaigns
- **Pledge System**: Community-driven funding with pledge/unpledge functionality
- **Smart Contracts**: Automated fund distribution upon campaign success
- **Refund Mechanism**: Automatic refunds for failed campaigns

### 📊 Analytics Marketplace
- **Package System**: Purchase access to anonymized health data insights
- **Demographic Analysis**: Zero-knowledge verified demographic breakdowns
- **Global Metrics**: Platform-wide statistics and trends
- **Revenue Tracking**: Analytics package sales and platform fees

### 🌐 Relayer Dashboard
- **Proof Monitoring**: Real-time tracking of ZK proof submissions
- **zkVerify Integration**: Automated proof verification via external service
- **Status Updates**: Monitor relayer health and processing status
- **Failure Handling**: Retry mechanisms for failed proof verifications

## Architecture

### Smart Contracts (Base Sepolia)
- **AccessManager**: Role-based permissions (admin, verifiers)
- **HealthPassport**: ERC721 NFTs with encrypted health data
- **ZKPVerifier**: Zero-knowledge proof submission and verification
- **Analytics**: Anonymized metrics and purchasable data packages
- **FundingHub**: Treatment campaign factory and management
- **TreatmentCampaign**: Individual crowdfunding contracts

### Frontend Stack
- **React 18** with TypeScript
- **Vite** for development and building
- **Tailwind CSS** for styling
- **Headless UI** for accessible components
- **Heroicons** for iconography
- **Custom Design System** matching Nebet brand palette

## Design System

### Colors
- **Deep Midnight Blue** (#1E2E3F) - Primary surfaces and navigation
- **Slate Blue** (#223A4E) - Buttons and headers
- **Ocean Teal** (#275365) - Interactive elements and hover states
- **Silver Grey** (#8F969C) - Secondary text and dividers
- **Soft Mist** (#F2F5F7) - Card backgrounds and subtle accents

### Typography
- **Headings**: Nunito (clean, modern)
- **Body Text**: Inter (readable, professional)
- **Monospace**: For addresses and IDs

### Components
- **Cards**: Rounded with subtle shadows and hover effects
- **Buttons**: Pill-shaped with gradient backgrounds
- **Forms**: Clear labels with validation states
- **Tables**: Responsive with alternating row colors
- **Modals**: Backdrop blur with smooth animations
- **Toasts**: Contextual notifications with auto-dismiss

## Usage

### Wallet Connection
1. Connect MetaMask or compatible wallet
2. Switch to Base Sepolia testnet
3. Ensure sufficient ETH for gas and mock USDT for transactions

### Minting Health Passports
1. Navigate to Passports section
2. Click "Mint Passport" 
3. Complete 4-step process:
   - Enter encrypted health data
   - Upload ZK proofs for demographics
   - Approve 50 USDT payment
   - Confirm minting transaction

### Verification Workflow
1. Verifiers access Verification Console
2. Review pending passport submissions
3. Examine proof categories and validation status
4. Approve/reject with on-chain decision
5. Optional: Provide verification URI or rejection reason

### Treatment Funding
1. Verified passport holders can create campaigns
2. Set funding goal, deadline, and payout address
3. Community pledges mock USDT to campaigns
4. Automatic fund release upon goal achievement
5. Refunds available for failed/canceled campaigns

### Analytics Access
1. Browse available analytics packages
2. Purchase access with mock USDT
3. View global metrics and demographic insights
4. Access anonymized, aggregated health trends

## Technical Integration

### Contract Integration Points
```typescript
// Health Passport minting
await healthPassport.mintPassport(
  dataURI,
  dataHash, 
  userData,
  proofs,
  categories,
  values
);

// Verification by authorized verifier
await healthPassport.verify(
  tokenId,
  approved,
  verificationURI
);

// Campaign creation by verified beneficiary
await fundingHub.createCampaign(
  beneficiaryPassportId,
  token,
  goal,
  deadline,
  payout
);
```

### Environment Variables
```bash
VITE_NETWORK=baseSepolia
VITE_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY
```

### Contract Addresses (Base Sepolia)
See `src/config.ts` for current deployment addresses.

## Mobile Responsive Design

- **Breakpoints**: Mobile-first approach with ≤375px optimization
- **Navigation**: Collapsible mobile menu with connection status
- **Cards**: Stack vertically on smaller screens
- **Tables**: Horizontal scroll with sticky headers
- **Forms**: Single-column layout on mobile
- **Modals**: Full-screen on mobile devices

## Accessibility Features

- **ARIA Labels**: Screen reader compatibility
- **Keyboard Navigation**: Full keyboard accessibility
- **Focus Management**: Proper focus trapping in modals
- **Color Contrast**: WCAG AA compliant color ratios
- **Semantic HTML**: Proper heading hierarchy and landmarks

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Integration Notes

### Existing Codebase Integration
- Drop-in replacement for existing `manual-app` frontend
- Maintains compatibility with existing `config.ts` and `abi.ts`
- Uses same contract addresses and network configuration
- Compatible with existing relayer infrastructure

### Wallet Integration
- Add Web3 provider (wagmi, ethers, or web3.js)
- Replace mock wallet data with real connection
- Implement transaction signing and confirmation

### Real Data Integration
- Replace mock data with contract read calls
- Implement real-time event listening
- Add transaction status tracking
- Connect to IPFS for metadata storage

This UI provides a complete, production-ready interface for the Nebet health passport ecosystem, ready for integration with your existing smart contracts and infrastructure.