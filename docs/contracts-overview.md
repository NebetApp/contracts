# Nebet Smart Contract Overview

This document summarizes the key smart contracts that power the Nebet health ecosystem. Use it to understand how the backend is stitched together while building the UI or other off-chain services.

---

## AccessManager.sol

**Purpose:** central role-based access control for the entire protocol.

- Inherits OpenZeppelin `AccessControl`.
- Roles:
  - `DEFAULT_ADMIN_ROLE` – granted in the constructor; can add/remove other roles.
  - `VERIFIER_ROLE` – wallets allowed to verify passports.
  - `PAUSER_ROLE` – reserved for future pausable mechanics.
- Storage:
  - `mapping(address => Verifier)` where `Verifier { bool active; string name; string uri; }`.
- Key functions:
  - `constructor(address admin)` – grants `DEFAULT_ADMIN_ROLE` to `admin`.
  - `addVerifier(address account, string name, string uri)` – admin-only, grants `VERIFIER_ROLE` and stores metadata.
  - `removeVerifier(address account)` – admin-only, revokes role and metadata.
  - `isVerifier(address)` – view helper used in HealthPassport.
  - `verifierInfo(address)` – returns stored metadata.
- Events: `VerifierAdded`, `VerifierRemoved`.

---

## MockERC20.sol

**Purpose:** Mock USDT used for testing/Base Sepolia.

- Inherits OZ `ERC20` with configurable decimals.
- Functions: `mint(to, amount)` and `burn(from, amount)` are open (used for test faucets).
- In deployment script it mints 100,000 mUSDT (6 decimals) to key addresses.
- Passport fee constant is 50 mUSDT (`50 * 10^6`).

---

## ZKPVerifier.sol

**Purpose:** Receives proofs on-chain, stores queue until the relayer confirms via zkVerify.

- Enum `DemographicCategory { BirthYear, Nationality, VaccineStatus, MedicationType, AllergyType, TreatmentType }`.
- `Proof { uint256[2] a; uint256[2][2] b; uint256[2] c; uint256[] inputs; }`.
- `ProofRecord { submitter; category; value; proofHash; submissionId; bool verified; }`.
- Storage: `admin`, `relayer`, `nextProofId`, `_proofs`, `verifiedDemographics[category][value]`.
- Functions:
  - `constructor(address admin_, address relayer_)`.
  - `setRelayer`, `setAdmin` (admin-only).
  - `submitProof`, `submitProofBatch` – called by HealthPassport during mint.
  - `markVerified`, `markVerifiedBatch` – relayer-only. Emits `ProofVerified` and increments aggregate counts.
  - `isVerified`, `proofInfo`, `getDemographicCount`.
- Events: `ProofSubmitted`, `ProofVerified`, `RelayerUpdated`, `AdminUpdated`.
- Errors: `NotAdmin`, `NotRelayer`, `InvalidArrays`, `ProofNotFound`, `AlreadyVerified`.

---

## Analytics.sol

**Purpose:** Tracks anonymized metrics + sells analytics packages.

- Immutable references: `accessManager`, `zkpVerifier`, `usdtToken`.
- `healthPassport` must be set exactly once via `setHealthPassport` (admin check).
- `GlobalMetrics { totalPassports; verifiedPassports; totalRevenue; lastUpdated; }`.
- `AnalyticsPackage { name; description; price; bool active; uint256[] includedMetrics; }`.
- Stores demographic counts in `_verifiedDemographicCounts[keccak(category, value)]`.
- Functions:
  - `updatePassportMetrics(totalPassports, verifiedPassports, revenue)` – called by HealthPassport mint/verify.
  - `createAnalyticsPackage`, `purchaseAnalytics`, `withdrawFees` – admin or public flows.
  - `recordVerifiedDemographic(category, value, amount)` – called from HealthPassport.verify after zk proofs verified.
  - `getGlobalMetrics`, `getVerifiedDemographicCount`, `getVerifiedDemographicBatch`.
- Events: `HealthPassportSet`, `PassportMetricsUpdated`, `AnalyticsPackageCreated`, `AnalyticsDataPurchased`, `VerifiedDemographicRecorded`.

---

## HealthPassport.sol

**Purpose:** ERC721 NFT representing a user’s encrypted health passport.

- Constants: `PASSPORT_FEE = 50 * 10^6` (50 mUSDT).
- Structs:
  - `UserData { encryptedName; encryptedBirthDate; encryptedNationality; encryptedVaccines; encryptedMedications; encryptedAllergies; encryptedTreatments; }`
  - `Passport { dataURI; dataHash; createdAt; updatedAt; Status status; address lastVerifier; string verificationURI; UserData userData; }`
  - `StoredProof { proofId; IZKPVerifier.DemographicCategory category; uint256 value; }`
  - `VerificationRequest { tokenId; method; requestTime; bool fulfilled; bytes proof; }`
- Enums: `Status { None, Pending, Verified, Rejected, Revoked }`, `VerificationMethod { Manual, Oracle, ZKP }`.
- Storage: mappings `_passports`, `_storedProofs`, `verificationRequests`, `_analytics`, `_nextTokenId`.
- Functions:
  - `mintPassport(dataURI, dataHash, userData, proofs[], categories[], values[])`
    - Pulls 50 mUSDT via `usdtToken.safeTransferFrom`.
    - Mints ERC721 to caller, stores passport data, status Pending.
    - Submits proofs to `ZKPVerifier.submitProofBatch` and stores proof IDs.
    - Updates `Analytics` via `updatePassportMetrics`.
  - `upsert(tokenId, dataURI, dataHash)` – owner-only; resets status to Pending if previously Verified.
  - `submitForVerification(tokenId)` – owner-only; logs a manual verification request.
  - `verify(tokenId, approved, verificationURI)` – requires `AccessManager.isVerifier(msg.sender)`. Updates status, increments analytics + demographic counts (requires ZKP proofs already marked verified by relayer).
  - `revoke(tokenId, reason)` – AccessManager admin check.
  - Views: `isVerified`, `passportOf`, `getUserData`, `getProofRecords`, `getAnalyticsData`.
- Events: `PassportMinted`, `PassportUpserted`, `SubmittedForVerification`, `Verified`, `VerificationFulfilled`, `Revoked`.

---

## FundingHub.sol

**Purpose:** Factory/controller for treatment campaigns.

- Constructor wires: `IAccessManager`, `IHealthPassport`, `campaignImplementation` (TreatmentCampaign clone template), and admin.
- Functions:
  - `createCampaign(beneficiaryPassportId, token, goal, deadline, payout)`
    - Requires `passport.isVerified(beneficiaryPassportId)`.
    - Clones implementation via OZ `Clones` and initializes with beneficiary wallet (NFT owner) + payout.
    - Emits `CampaignCreated` with data.
  - `setAdmin` – admin-only.
  - `cancelCampaign`, `pauseCampaign`, `unpauseCampaign` – admin-only, low-level delegate.
- Emits: `CampaignCreated`, `CampaignCanceled`, `Paused`, `Unpaused`, `AdminChanged`.

---

## TreatmentCampaign.sol

**Purpose:** Minimal-proxy crowdfunding contract for individual treatments.

- State: `hub`, `token` (ERC20), `beneficiary`, `payout`, `goal`, `deadline`, `_state`, `totalPledged`, `pledges`, `_initialized`.
- Enum `State { Active, Successful, Failed, Canceled, Withdrawn }` (exposed via `state()` view).
- Functions:
  - `initialize(hub, token, beneficiary, payout, goal, deadline)` – called once by FundingHub clone.
  - `pledge(amount)` / `unpledge(amount)` – enforce Active state & pre-deadline; uses `SafeERC20`.
  - `finalize()` – sets state to Successful if goal met or deadline passed; else Failed.
  - `withdraw()` – beneficiary withdraws funds once Successful; transfers to `payout`.
  - `claimRefund()` – donors reclaim funds if Failed or Canceled.
  - `cancel()` – hub-only; sets state to Canceled.
  - `pause()` / `unpause()` – hub-only (via inherited `Pausable`).
- Events: `Pledged`, `Unpledged`, `Finalized`, `Withdrawn`, `Refunded`, `Canceled`.
- Guarded by `ReentrancyGuard` for all fund movement functions.

---

## Deployment Notes

- Deployment script `scripts/deploy-base-sepolia.ts` handles:
  - Contract deployments in dependency order.
  - HealthPassport ↔ Analytics wiring (calls `setHealthPassport` if deployer == admin).
  - Mock USDT faucet mints to deployer/admin/relayer/patient/donor.
  - Adds verifier automatically if deployer = admin; otherwise warns.
  - Writes deployment summary JSON under `deployments/<network>-latest.json` (contains contract addresses, block numbers, participants).

- The JSON file is consumed by frontend/relayer to load addresses. Example keys: `contracts.healthPassport`, `blocks.healthPassport`.

---

## Relayer Overview (off-chain)

`relayer/src/index.ts` listens for `ZKPVerifier.ProofSubmitted` events, reconstructs proof payloads (from `submitProof` or `HealthPassport.mintPassport` calldata), submits to zkVerify REST API, then calls `markVerified` once verified. Configuration uses `.env` (`RPC_URL`, `RELAYER_PRIVATE_KEY`, `ZKVERIFY_API_URL`, etc.) and deployment JSON for addresses.

---

## Frontend Integration Checklist

- Load contract addresses from `deployments/baseSepolia-latest.json` (with a fallback for local Hardhat addresses in `manual-app/src/config.ts`).
- For wallet interactions, ensure USDT approval (50 mUSDT) before calling `mintPassport`.
- Map demographic categories 0–5 to user-friendly labels.
- Passport view should display status transitions, proof records, verification URIs, metadata pulled via `tokenURI` (IPFS support).
- Analytics view should call `getGlobalMetrics` and demographic batch queries to populate charts.
- Funding view should display clones returned by `CampaignCreated` events (goals, pledged amounts, deadlines) and enable pledge/unpledge flows.
- Relayer monitor should surface proof queue + verification statuses (mirroring off-chain logs).

This overview should cover everything you need to build rich UI components or integrate additional services without diving into the Solidity source files.
