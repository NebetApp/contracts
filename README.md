# Nebet - Health Passport + Crowdfunding (Base)

## Key Ideas
- **Privacy-first:** Only `dataURI` + `dataHash` on-chain; store encrypted health data off-chain (IPFS/Filecoin/Web2).
- **Attestations:** Verifiers (clinics, NGOs) are managed by `AccessManager`.
- **Funding:** Each treatment = its own `TreatmentCampaign` clone deployed by `FundingHub`.

## Basic Flow
1. User encrypts health data → uploads → gets `uri` + `keccak256(ciphertext)` → `HealthPassport.upsert(uri, hash)` → `submitForVerification()`.
2. Admin whitelists verifier → verifier calls `verify(user, approved, reportURI)`.
3. Verified user (beneficiary) calls `FundingHub.createCampaign(...)` with ERC20 token, goal & deadline.
4. Donors `approve` token → call `pledge(amount)`. They may `unpledge` before deadline.
5. Anyone `finalize()`; if goal met → beneficiary `withdraw()` to payout; else donors `claimRefund()`.

## Notes
- Consider adding EIP-712 `permit()` support to streamline pledging.
- Consider allowlists for accepted ERC20s and per-campaign KYC policy.
- Proof verification is now delegated to zkVerify: proofs submitted during mint are relayed off-chain and only contribute to analytics after the relayer confirms zkVerify has attested them.

## Deploying to Base Sepolia

- Configure environment variables: `BASE_SEPOLIA_RPC_URL`, `BASE_SEPOLIA_DEPLOYER_KEY`, and optional overrides for admin/relayer/verifier addresses.
- Run `npx hardhat run scripts/deploy-base-sepolia.ts --network baseSepolia`.
- Update `manual-app/src/config.ts` with the emitted addresses and run the UI with `VITE_NETWORK=baseSepolia` and a valid RPC URL.
- Point a relayer service at `contracts/ZKPVerifier.sol` to forward `ProofSubmitted` jobs to zkVerify and call `markVerified` when zkVerify confirms them.
- A step-by-step guide lives in `docs/base-sepolia-deployment.md`, and the reference relayer setup is documented in `docs/relayer-setup.md`.

## Manual Testing UI
- A lightweight dashboard lives in `manual-app/`. Follow `manual-app/README.md` to deploy the contracts locally and interact with every module (passport mint/verify, analytics, funding campaigns, and ZK proofs).
