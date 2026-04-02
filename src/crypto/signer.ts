import {
  type Connection,
  type VersionedTransaction,
  type Transaction,
  type SendOptions,
} from '@solana/web3.js';
import { loadKeypair } from './keypair.js';
import { getConnection, getSDK } from '../sdk/client.js';
import { t } from '../output/theme.js';
import { spin, succeed, fail } from '../output/spinner.js';
import type { JitoRegion } from '@bagsfm/bags-sdk/dist/types/solana.js';
import bs58 from 'bs58';

export async function signAndSend(
  tx: VersionedTransaction,
  opts?: { dryRun?: boolean; label?: string },
): Promise<string> {
  const keypair = loadKeypair();
  const connection = getConnection();
  const label = opts?.label ?? 'transaction';

  tx.sign([keypair]);

  if (opts?.dryRun) {
    const serialized = bs58.encode(tx.serialize());
    console.log(t.dim(`\nSigned ${label} (dry-run):`));
    console.log(serialized);
    return 'dry-run';
  }

  spin(`Sending ${label}...`);
  const sig = await connection.sendTransaction(tx, {
    skipPreflight: false,
  } as SendOptions);

  spin(`Confirming ${label}...`);
  const result = await connection.confirmTransaction(sig, 'confirmed');

  if (result.value.err) {
    fail(`${label} failed`);
    throw new Error(`Transaction failed: ${JSON.stringify(result.value.err)}`);
  }

  succeed(`${label} confirmed: ${sig}`);
  return sig;
}

export async function signAndSendLegacy(
  tx: Transaction,
  opts?: { dryRun?: boolean; label?: string },
): Promise<string> {
  const keypair = loadKeypair();
  const connection = getConnection();
  const label = opts?.label ?? 'transaction';

  tx.sign(keypair);

  if (opts?.dryRun) {
    const serialized = bs58.encode(tx.serialize());
    console.log(t.dim(`\nSigned ${label} (dry-run):`));
    console.log(serialized);
    return 'dry-run';
  }

  spin(`Sending ${label}...`);
  const sig = await connection.sendRawTransaction(tx.serialize());

  spin(`Confirming ${label}...`);
  const result = await connection.confirmTransaction(sig, 'confirmed');

  if (result.value.err) {
    fail(`${label} failed`);
    throw new Error(`Transaction failed: ${JSON.stringify(result.value.err)}`);
  }

  succeed(`${label} confirmed: ${sig}`);
  return sig;
}

export async function signAndSendBundle(
  txs: VersionedTransaction[],
  opts?: { dryRun?: boolean; region?: JitoRegion },
): Promise<string> {
  const keypair = loadKeypair();
  const sdk = getSDK();

  for (const tx of txs) {
    tx.sign([keypair]);
  }

  if (opts?.dryRun) {
    console.log(t.dim(`\nSigned bundle of ${txs.length} transaction(s) (dry-run):`));
    for (let i = 0; i < txs.length; i++) {
      console.log(t.dim(`\n[${i + 1}]:`));
      console.log(bs58.encode(txs[i].serialize()));
    }
    return 'dry-run';
  }

  spin(`Sending bundle of ${txs.length} transaction(s)...`);
  const bundleId = await sdk.solana.sendBundle(txs, opts?.region);

  spin('Waiting for bundle confirmation...');
  let confirmed = false;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const statuses = await sdk.solana.getBundleStatuses([bundleId], opts?.region);
    if (statuses?.value?.[0]?.confirmation_status === 'confirmed' ||
        statuses?.value?.[0]?.confirmation_status === 'finalized') {
      confirmed = true;
      break;
    }
  }

  if (confirmed) {
    succeed(`Bundle confirmed: ${bundleId}`);
  } else {
    fail(`Bundle may not have landed: ${bundleId}`);
  }

  return bundleId;
}
