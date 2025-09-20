# zkVerify Relayer Setup

This Node.js service listens for `ProofSubmitted` events on-chain, forwards proofs to zkVerify, and calls `markVerified` once zkVerify confirms them. Run it alongside the Base Sepolia deployment to complete the end-to-end verification loop.

## 1. Install dependencies

```bash
cd relayer
npm install
```

## 2. Configure environment

Copy `.env.example` to `.env` and provide the required values:

```bash
cp .env.example .env
```

Key variables:

- `RPC_URL` – Base Sepolia (or local Hardhat) RPC endpoint
- `RELAYER_PRIVATE_KEY` – private key of the relayer wallet granted permission to call `markVerified`
- `DEPLOYMENT_FILE` – path to the deployment summary JSON (defaults to `../deployments/baseSepolia-latest.json`)
- `NETWORK` – `baseSepolia` or `local`
- `FROM_BLOCK` – optional start block for replaying historical `ProofSubmitted` events
- `ZKVERIFY_API_URL` / `ZKVERIFY_API_KEY` / `ZKVERIFY_PROGRAM_ID` – REST endpoint + credentials for zkVerify

> The template assumes zkVerify exposes REST endpoints:
> - `POST /proofs` – submits a proof for verification (payload includes proof data and public signals)
> - `GET /proofs/{jobId}` – returns the job status (`verified`, `failed`, etc.)
>
> Adjust `submitViaZkVerify` and `waitForZkVerify` in `src/index.ts` if the actual API differs.

## 3. Run the relayer

Development mode (auto-reload):

```bash
npm run dev
```

Production build:

```bash
npm run build
npm start
```

The service will:

1. Optionally replay past `ProofSubmitted` logs (from `FROM_BLOCK`).
2. Watch for new `ProofSubmitted` events.
3. Extract the full proof from the originating transaction calldata.
4. Submit the proof to zkVerify and poll until the job succeeds.
5. Call `markVerified(proofId, submissionId)` from the relayer wallet.

Logs indicate each step (`↳ proof detected`, `→ sending to zkVerify`, `✔ marked verified`). Failures (API errors, proof mismatches, reverted `markVerified`) are logged without crashing the process.

## 4. Customisation tips

- **Batch confirmations**: replace the single `markVerified` call with `markVerifiedBatch` when zkVerify returns results for multiple proofs at once.
- **Persistence**: persist processed proof IDs (e.g. levelDB, Redis) to survive restarts without replaying from `FROM_BLOCK`.
- **Alerting**: hook failures into your monitoring stack so relayer issues surface quickly.
- **Security**: keep the relayer private key in a secure secret manager. The `.env` file is `.gitignore`d but should not be committed.

With the relayer running, proofs submitted on Base Sepolia will flow through zkVerify and unblock the on-chain verification workflow automatically.
