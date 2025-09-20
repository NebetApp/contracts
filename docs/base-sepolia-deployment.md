# Base Sepolia Deployment Guide

This walkthrough promotes the local Hardhat stack to the Base Sepolia testnet using the zkVerify adapter. The goal is to mimic a production setup: contracts live on Base Sepolia, zk proofs are handed off to zkVerify, and the manual dashboard points to the live network.

## 1. Prerequisites

- Node.js 18+
- Hardhat CLI (`npx hardhat`)
- RPC endpoint for Base Sepolia (Alchemy, Blast, QuickNode, etc.)
- A funded private key with Base Sepolia ETH (used as the deployer/admin)
- Optional: distinct wallets for relayer, verifier, patient, donor (recommended)
- Access to zkVerify’s public API (see https://docs.zkverify.io/)

Store secrets via environment variables; never commit them to Git.

```bash
export BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"
export BASE_SEPOLIA_DEPLOYER_KEY="ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

# Optional overrides (default to deployer address if omitted)
export BASE_ADMIN_ADDRESS="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
export BASE_RELAYER_ADDRESS="0x4f9f3a19B458f21B506A3E6740c8e0F97Eead0ca"
export BASE_VERIFIER_ADDRESS="0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
export BASE_PATIENT_ADDRESS="0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199"
export BASE_DONOR_ADDRESS="0x33D435EA4624bf699032f4BAD4159d95915Fb636"
```

> \*The relayer is the service that listens for `ProofSubmitted` events, forwards jobs to zkVerify, and then calls `markVerified`/`markVerifiedBatch` once zkVerify has attested the proof.

## 2. Deploy contracts

```bash
npx hardhat run scripts/deploy-base-sepolia.ts --network baseSepolia
```

The script will:

1. Deploy `MockERC20`, `AccessManager`, `ZKPVerifier`, `Analytics`, `HealthPassport`, `TreatmentCampaign`, and `FundingHub`.
2. Mint test USDT to the deployer / optional addresses.
3. Wire `Analytics.setHealthPassport` (if the deployer is also the admin).
4. Emit a deployment summary at `deployments/baseSepolia-latest.json`.

If you provided different admin or relayer addresses, the script skips the calls they must execute themselves (see console warning messages). Keep the JSON handy—it feeds the front-end configuration.
The summary now includes a `blocks` object with the deployment block for each contract—use those block numbers as the `FROM_BLOCK` value when booting the relayer.

## 3. Hook zkVerify into the relayer

The new `ZKPVerifier` contract merely queues proofs and exposes `ProofSubmitted` / `ProofVerified` events. The live proof verification happens off-chain:

1. **Listen for jobs** – run a small service (Node.js/Go) watching `ProofSubmitted(proofId, submitter, category, value, proofHash)`.
2. **Submit to zkVerify** – call the zkVerify API with the proof blob, specifying the verification circuit you use for demographics. Store the submission id returned by zkVerify.
3. **Await confirmation** – poll zkVerify or subscribe to its event stream until the proof is confirmed.
4. **Finalize on-chain** – call `markVerified(proofId, submissionId)` (or batch variant) from the relayer wallet. Every successful call increments the demographic counters and unblocks `HealthPassport.verify`.

The repository ships with a reference Node.js relayer under `/relayer`. Follow [docs/relayer-setup.md](./relayer-setup.md) to configure it, point it at your deployment JSON, and adapt the zkVerify REST calls if needed.

See the official docs for REST endpoints, proof formats, and credential setup: https://docs.zkverify.io/.

## 4. Configure the manual tester

Update `manual-app/src/config.ts`:

1. Paste the Base Sepolia addresses from `deployments/baseSepolia-latest.json` into the `baseSepolia` contract slots.
2. Set the environment before running Vite:

```bash
cd manual-app
npm install
VITE_NETWORK=baseSepolia \
VITE_RPC_URL="https://base-sepolia.g.alchemy.com/v2/<your-key>" \
npm run dev
```

Connect MetaMask/Rabby to Base Sepolia (chain id 84532) with the same accounts you used during deployment. Use the “ZKP Relayer Tools” panel to simulate relayer actions while your actual service is still under development.

## 5. Post-deployment checklist

- [ ] Fund patient/donor wallets with mock USDT if you plan to demo crowdfunding flows.
- [ ] Grant additional verifiers via `AccessManager.addVerifier`.
- [ ] Wire the relayer to zkVerify and confirm proofs flip to `verified: true` in the UI.
- [ ] Backfill contracts addresses into any downstream services or explorers.
- [ ] If you operate a real USDT bridge/token, replace `MockERC20` with the production ERC20 and redeploy.

With these pieces in place the Base Sepolia deployment mirrors production: passports mint against live infrastructure, proofs ride through zkVerify, and analytics reflect only attested demographics.
