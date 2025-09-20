# Nebet Health Passport + Crowdfunding Protocol

## Architecture Overview
This is a privacy-first health passport and crowdfunding dApp with three core components:
- **AccessManager**: Centralized RBAC managing verifiers (clinics/NGOs) and admins
- **HealthPassport (NFT)**: ERC721 NFT storing encrypted PHI off-chain; NFT ownership grants access to encrypted health data
- **Analytics**: Tracks anonymized demographic metrics for data marketplace
- **FundingHub + TreatmentCampaign**: Factory pattern using OpenZeppelin Clones for ERC20-based crowdfunding

## Key Design Patterns

### NFT-Based Health Passport
- **ERC721 NFT**: Passport ownership represented by NFT token
- **Encrypted User Data**: Basic info (name, DOB, nationality, vaccines, medications, allergies, treatments) stored encrypted, only accessible to NFT owner
- **50 USDT Creation Fee**: Required payment in USDT to mint passport NFT
- **Verification Workflow**: Structured verification requests with manual admin approval, extensible to oracles/ZKP

### Privacy-First Health Data
- On-chain: `dataURI` (IPFS/Filecoin) + `dataHash` for integrity verification
- Off-chain: Encrypted health data stored externally, decrypted only by NFT owner
- **ZKP Analytics**: Zero-knowledge proofs enable demographic queries without revealing individual data
- Analytics: ZK-verified demographic data (birth year ranges, nationalities) for marketplace

### Zero-Knowledge Proof System
- **ZKPVerifier Adapter**: Emits zkVerify proof jobs and records demographic counts once a relayer reports successful verification
- **Demographic Categories**: BirthYear, Nationality, VaccineStatus, MedicationType, AllergyType, TreatmentType
- **Privacy-Preserving Analytics**: Prove properties like "born in 1990s" without revealing exact birth date
- **Batch Verification**: Submit multiple demographic proofs when minting passport
- **Asynchronous Attestation**: HealthPassport blocks manual verification until the zkVerify relayer marks every submitted proof as verified

### Crowdfunding Mechanics
- **Pledge/Unpledge**: Donors can commit tokens before deadline, unpledge if needed
- **Finalize**: Anyone can call `finalize()` after deadline; success if `totalPledged >= goal`
- **Pull Payments**: Beneficiaries `withdraw()` successful campaigns; donors `claimRefund()` failed ones
- **State Machine**: `Active → Successful/Failed/Canceled → Withdrawn`

### Security Patterns
- `ReentrancyGuard` + `Pausable` on all state-changing functions
- Zero address validation on all constructor/initializer parameters
- Access control via `AccessManager` roles (VERIFIER_ROLE, DEFAULT_ADMIN_ROLE)
- Low-level calls to avoid ABI bloat in cross-contract interactions

## Development Workflow

### Testing
```typescript
// Use Viem assertions for event testing
await viem.assertions.emitWithArgs(
  counter.write.inc(),
  counter,
  "Increment",
  [1n],
);

// Aggregate events to verify state
const events = await publicClient.getContractEvents({...});
```

### Deployment
- Use Hardhat Ignition modules for deterministic deployments
- Configure networks in `hardhat.config.ts` with `chainType` for OP Stack support
- Deploy order: AccessManager → ZKPVerifier → Analytics → HealthPassport → FundingHub
- HealthPassport constructor needs: `IAccessManager`, `IERC20(usdtToken)`, `IAnalytics`, `IZKPVerifier`
- Production-like deployments use `scripts/deploy-base-sepolia.ts --network baseSepolia` with env-driven admin/relayer/verifier addresses

### Scripts
- TypeScript with ES modules (`"type": "module"` in package.json)
- Use `network.connect()` with specific network configs
- Estimate L1 gas for OP Stack transactions

## Code Conventions

### Contract Structure
- SPDX license headers on all files
- Comprehensive NatSpec documentation (`@title`, `@notice`, `@dev`)
- Custom errors over require strings: `error NotOwner();`
- Immutable variables for core dependencies: `IAccessManager public immutable accessManager;`

### Interface Design
- Separate interface files in `contracts/interfaces/`
- Include view functions for external state access
- Enums for state machines: `enum Status { None, Pending, Verified, Rejected, Revoked }`
- NFT interfaces extend ERC721 standards

### Event Patterns
- Emit events for all state changes with indexed parameters
- Include relevant context: `emit Verified(tokenId, msg.sender, approved, verificationURI);`
- Separate events for verification requests vs fulfillment

### Modifier Usage
- `onlyAdmin()` for admin-gated functions
- `onlyHub()` for factory-controlled campaign functions
- `nonReentrant whenNotPaused` for user-facing state changes

## Common Patterns

### Passport Creation Flow
```solidity
// 1. Patient generates zk-SNARK proofs off-chain (to be verified by zkVerify)
IZKPVerifier.Proof[] memory proofs = assembleDemographicProofs(userData);

// 2. Collect fee and mint NFT
usdtToken.safeTransferFrom(msg.sender, address(this), PASSPORT_FEE);
tokenId = _nextTokenId++;
_mint(msg.sender, tokenId);

// 3. Queue proofs for zkVerify network
uint256[] memory proofIds = zkpVerifier.submitProofBatch(proofs, categories, values);
_storeProofReferences(tokenId, proofIds, categories, values);

// 4. Update aggregate metrics (demographic counts are updated once zkVerify attests)
analytics.updatePassportMetrics(_analytics.totalPassports, _analytics.verifiedPassports, PASSPORT_FEE);
```

### Verification Workflow
```solidity
// 1. User submits for verification
verificationRequests[tokenId] = VerificationRequest({
    method: VerificationMethod.Manual,
    requestTime: block.timestamp,
    fulfilled: false
});

// 2. Admin/verifier approves
passports[tokenId].status = Status.Verified;
verificationRequests[tokenId].fulfilled = true;
```

### Analytics Data Tracking
```solidity
// zkVerify relayer confirms proof completion
zkpVerifier.markVerifiedBatch(proofIds, submissionIds);

// HealthPassport.verify() checks every proofId is verified before approving
require(zkpVerifier.isVerified(proofId), "Proof not verified");
analytics.recordVerifiedDemographic(uint8(category), value, 1);

// Frontend queries only verified aggregates
uint256 count = analytics.getVerifiedDemographicCount(uint8(IZKPVerifier.DemographicCategory.BirthYear), 1990);
```

### Campaign Creation with NFT Verification
```solidity
// Verify beneficiary owns verified passport NFT
require(passport.isVerified(beneficiaryPassportId), "Beneficiary not verified");
address beneficiary = passport.ownerOf(beneficiaryPassportId);

// Create campaign for the beneficiary
campaign = campaignImplementation.clone();
ITreatmentCampaign(campaign).initialize(address(this), token, beneficiary, payout, goal, deadline);
```

## Key Files
- `contracts/AccessManager.sol`: Central RBAC and verifier registry
- `contracts/HealthPassport.sol`: ERC721 NFT with encrypted health data and verification
- `contracts/Analytics.sol`: Anonymized metrics tracking and data marketplace
- `contracts/ZKPVerifier.sol`: zkVerify adapter that queues proofs and records verified demographics
- `contracts/FundingHub.sol`: Campaign factory with NFT-based beneficiary verification
- `contracts/TreatmentCampaign.sol`: Individual crowdfunding campaign logic
- `hardhat.config.ts`: Multi-network configuration with OP Stack support</content>
<parameter name="filePath">/Users/alamadrid/Documents/Projects/nebet-contracts/.github/copilot-instructions.md
