import { Command } from 'commander';
import { VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { getSDK } from '../sdk/client.js';
import { getConnection } from '../sdk/client.js';
import { t } from '../output/theme.js';
import { kv, jsonOut, table } from '../output/format.js';
import { spin, succeed } from '../output/spinner.js';
import { withErrorHandler } from '../utils/error.js';
import { loadKeypair } from '../crypto/keypair.js';
import type { JitoRegion } from '@bagsfm/bags-sdk/dist/types/solana.js';

export const txCommand = new Command('tx').description(
  'Transaction operations',
);

txCommand
  .command('send')
  .description('Send a base58-encoded signed transaction')
  .requiredOption('--tx <base58>', 'Base58-encoded serialized transaction')
  .action(
    withErrorHandler(async (opts, cmd) => {
      const isJson = cmd.optsWithGlobals().json;
      const connection = getConnection();

      spin('Sending transaction...');
      const txBytes = bs58.decode(opts.tx);
      const sig = await connection.sendRawTransaction(txBytes);

      spin('Confirming...');
      const result = await connection.confirmTransaction(sig, 'confirmed');

      if (result.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(result.value.err)}`);
      }

      succeed(`Confirmed: ${sig}`);

      if (isJson) {
        jsonOut({ signature: sig });
      }
    }),
  );

txCommand
  .command('bundle')
  .description('Send a Jito bundle')
  .requiredOption('--txs <base58list>', 'Comma-separated base58 transactions')
  .option('--region <region>', 'Jito region', 'mainnet')
  .action(
    withErrorHandler(async (opts, cmd) => {
      const isJson = cmd.optsWithGlobals().json;
      const sdk = getSDK();
      const txStrings = (opts.txs as string).split(',').map((s: string) => s.trim());

      spin(`Sending bundle of ${txStrings.length} transaction(s)...`);
      const bundleId = await sdk.solana.sendBundle(
        txStrings,
        opts.region as JitoRegion,
      );
      succeed(`Bundle sent: ${bundleId}`);

      if (isJson) {
        jsonOut({ bundleId });
      }
    }),
  );

txCommand
  .command('bundle-status')
  .description('Check Jito bundle status')
  .requiredOption('--ids <idlist>', 'Comma-separated bundle IDs')
  .option('--region <region>', 'Jito region', 'mainnet')
  .action(
    withErrorHandler(async (opts, cmd) => {
      const isJson = cmd.optsWithGlobals().json;
      const sdk = getSDK();
      const ids = (opts.ids as string).split(',').map((s: string) => s.trim());

      spin('Checking bundle status...');
      const statuses = await sdk.solana.getBundleStatuses(
        ids,
        opts.region as JitoRegion,
      );
      succeed();

      if (isJson) {
        jsonOut(statuses);
        return;
      }

      if (!statuses?.value?.length) {
        console.log(t.dim('No bundle statuses found.'));
        return;
      }

      for (const s of statuses.value) {
        console.log(
          kv([
            ['Bundle ID', s.bundle_id],
            ['Status', s.confirmation_status ?? 'pending'],
            ['Slot', s.slot ? String(s.slot) : '-'],
          ]),
        );
        console.log();
      }
    }),
  );

txCommand
  .command('jito-fees')
  .description('Get recent Jito tip fees')
  .action(
    withErrorHandler(async (_, cmd) => {
      const isJson = cmd.optsWithGlobals().json;
      const sdk = getSDK();

      spin('Fetching Jito fees...');
      const fees = await sdk.solana.getJitoRecentFees();
      succeed();

      if (isJson) {
        jsonOut(fees);
        return;
      }

      console.log(kv(Object.entries(fees).map(([k, v]) => [k, String(v)])));
    }),
  );
