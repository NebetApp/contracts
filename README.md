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

## Manual Testing UI
- A lightweight dashboard lives in `manual-app/`. Follow `manual-app/README.md` to deploy the contracts locally and interact with every module (passport mint/verify, analytics, funding campaigns, and ZK proofs).
