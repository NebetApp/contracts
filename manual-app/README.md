# Nebet Manual Tester UI

This minimal Vite + React dashboard lets you poke every contract in the Nebet suite while keeping the smart-contract workspace untouched. It targets a local Hardhat node and focuses on the core happy-path flows (passport mint/verify, funding campaigns, analytics updates, and demographic proofs).

## 1. Prerequisites

- Node.js 18+
- `npm` (or `pnpm`/`yarn` if you prefer)
- MetaMask/Rabby configured with the Hardhat localhost network (chain id 31337)

## 2. Start a local chain & deploy contracts

From the repository root:

```bash
# terminal A - start a Hardhat fork
npx hardhat node
```

In another terminal:

```bash
# terminal B - deploy everything and seed helpers
npx hardhat run scripts/deploy-local.ts --network localhost
```

The deploy script writes `deployments/localhost-latest.json` and mints mock USDT to the first four Hardhat accounts. It also assigns `VERIFIER_ROLE` to the third account so you can switch wallets during manual tests.

## 3. Point the UI at your deployment

Update `manual-app/src/config.ts` with the addresses emitted in `deployments/localhost-latest.json`. If you rerun the deploy script, repeat this step (addresses change on every fresh node).

```ts
export const CONTRACTS: ContractConfig = {
  accessManager: "0x…",
  analytics: "0x…",
  fundingHub: "0x…",
  healthPassport: "0x…",
  mockUsdt: "0x…",
  treatmentImplementation: "0x…",
  zkpVerifier: "0x…"
};
```

## 4. Launch the dashboard

```bash
cd manual-app
npm install
npm run dev
```

Open http://127.0.0.1:5173/ and connect with one of the Hardhat accounts imported into MetaMask (Account #0 is the deployer/admin).

## 5. Suggested manual test flow

1. **Access Manager** – while connected as the admin (account #0), add the verifier account (account #2). Switch to account #2 and verify you can no longer add new verifiers.

- Add and remove verifier from admin works
- Add and remove verifier from non-admin reverts
- Get Verifier info works for everyone

2. **Mock USDT** – mint yourself tokens and approve spenders. You’ll need to:
   - Approve the HealthPassport contract before minting a passport.
   - Approve campaign clone addresses before pledging.

- Works

3. **Health Passport + zkVerify** – with account #1 (patient):
   - Mint a passport (queue as many demographic proofs as you need before clicking Mint).
   - Use “Fetch Proof Records” to see the proof IDs assigned by the zkVerify adapter.
   - Switch to the relayer/admin account (#0), open **ZKP Relayer Tools**, and call “Mark Proof Verified” for each proof (MetaMask will prompt once per call). In production this step is automated by the zkVerify network.
   - Switch to the verifier account (#2) and approve the passport. Verified counts update in both Analytics and the ZKP relayer view.

- Mint works
- Fetch Proof Records work
- Verify proof by non-admin reverts
- Verify proof by admin works
- Approval works
- Counts update

4. **Funding Hub** – as admin (#0) or patient (#1):
   - Create a campaign for the verified passport ID (deadline is expressed in minutes from “now”).
   - Copy the emitted campaign address and approve it as a USDT spender.
   - Use a donor account (#3) to pledge, unpledge, finalise, and withdraw/refund as needed.

- Campaign creation works
- Approval works
- Cycle works

5. **Analytics** – refresh global metrics, create a sample analytics package, purchase it with another account, and query verified demographic counts for the proof values you marked.

- Works

6. **Encrypted Data** – as the passport owner, click “Load & Decrypt User Data” to request MetaMask decryption and confirm the stored ciphertext round-trips correctly.

- Works

## 6. Troubleshooting tips

- “transaction failed” usually means the connected account lacks the required role or allowance. Use the AccessManager and Mock USDT panels to fix it.
- If MetaMask complains about the network, add the chain with RPC `http://127.0.0.1:8545`, chain id `31337`, currency symbol `ETH`.
- Restarting `hardhat node` wipes storage, so redeploy and refresh the config before relaunching the UI.

Happy testing!