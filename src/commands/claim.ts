import { Command } from 'commander';
import { PublicKey } from '@solana/web3.js';
import { getSDK, getRawClient, getConnection } from '../sdk/client.js';
import { t } from '../output/theme.js';
import { table, jsonOut, kv } from '../output/format.js';
import { spin, succeed } from '../output/spinner.js';
import { withErrorHandler } from '../utils/error.js';
import { lamportsToSol, shortenAddress } from '../utils/solana.js';
import { getWalletPublicKey } from '../crypto/keypair.js';
import { signAndSendLegacy } from '../crypto/signer.js';

export const claimCommand = new Command('claim').description(
  'Fee claiming operations',
);

claimCommand
  .command('positions')
  .description('List claimable fee positions')
  .option('--wallet <address>', 'Wallet address (defaults to configured key)')
  .action(
    withErrorHandler(async (opts, cmd) => {
      const isJson = cmd.optsWithGlobals().json;
      const sdk = getSDK();
      const wallet = opts.wallet
        ? new PublicKey(opts.wallet)
        : getWalletPublicKey();

      spin('Fetching claimable positions...');
      const positions = await sdk.fee.getAllClaimablePositions(wallet);
      succeed();

      if (isJson) {
        jsonOut(positions);
        return;
      }

      if (positions.length === 0) {
        console.log(t.dim('No claimable positions found.'));
        return;
      }

      console.log(
        table(
          ['Token', 'Claimable (SOL)', 'Migrated', 'Program'],
          positions.map((p) => [
            shortenAddress(p.baseMint ?? p.virtualPool),
            lamportsToSol(p.totalClaimableLamportsUserShare).toFixed(6),
            'isMigrated' in p ? (p.isMigrated ? 'Yes' : 'No') : '-',
            'programId' in p ? shortenAddress(String(p.programId)) : 'v1',
          ]),
        ),
      );

      const total = positions.reduce(
        (sum, p) => sum + p.totalClaimableLamportsUserShare,
        0,
      );
      console.log(
        t.success(`\nTotal claimable: ${lamportsToSol(total).toFixed(6)} SOL`),
      );
    }),
  );

claimCommand
  .command('stats')
  .description('Claim statistics per creator for a token')
  .requiredOption('--mint <address>', 'Token mint address')
  .action(
    withErrorHandler(async (opts, cmd) => {
      const isJson = cmd.optsWithGlobals().json;
      const sdk = getSDK();

      const client = getRawClient();

      spin('Fetching claim stats...');
      const stats = await client.get<Array<{ wallet: string; tokenMint: string; totalClaimed: string }>>('/token-launch/claim-stats', {
        params: { tokenMint: opts.mint },
      });
      succeed();

      if (isJson) {
        jsonOut(stats);
        return;
      }

      if (stats.length === 0) {
        console.log(t.dim('No claim stats found.'));
        return;
      }

      console.log(
        table(
          ['Wallet', 'Total Claimed'],
          stats.map((s) => [
            shortenAddress(s.wallet),
            `${lamportsToSol(s.totalClaimed).toFixed(6)} SOL`,
          ]),
        ),
      );
    }),
  );

claimCommand
  .command('events')
  .description('Claim event history for a token')
  .requiredOption('--mint <address>', 'Token mint address')
  .option('--limit <n>', 'Number of events', '50')
  .option('--offset <n>', 'Offset for pagination', '0')
  .option('--from <timestamp>', 'Start unix timestamp (time-range mode)')
  .option('--to <timestamp>', 'End unix timestamp (time-range mode)')
  .action(
    withErrorHandler(async (opts, cmd) => {
      const isJson = cmd.optsWithGlobals().json;

      let events: Array<{ wallet: string; isCreator: boolean; amount: string; signature: string; timestamp: number }>;

      if (opts.from || opts.to) {
        const client = getRawClient();
        spin('Fetching claim events (time-range)...');
        const result = await client.get<{ events: typeof events }>('/fee-share/token/claim-events', {
          params: {
            tokenMint: opts.mint,
            mode: 'time',
            from: opts.from ? parseInt(opts.from) : undefined,
            to: opts.to ? parseInt(opts.to) : undefined,
          },
        });
        events = result.events;
      } else {
        const sdk = getSDK();
        spin('Fetching claim events...');
        events = await sdk.state.getTokenClaimEvents(
          new PublicKey(opts.mint),
          { limit: parseInt(opts.limit), offset: parseInt(opts.offset) },
        );
      }
      succeed();

      if (isJson) {
        jsonOut(events);
        return;
      }

      if (events.length === 0) {
        console.log(t.dim('No claim events found.'));
        return;
      }

      console.log(
        table(
          ['Wallet', 'Amount (SOL)', 'Creator', 'Signature', 'Time'],
          events.map((e) => [
            shortenAddress(e.wallet),
            lamportsToSol(e.amount).toFixed(6),
            e.isCreator ? 'Yes' : 'No',
            shortenAddress(e.signature),
            new Date(e.timestamp * 1000).toLocaleString(),
          ]),
        ),
      );
    }),
  );

claimCommand
  .command('execute')
  .description('Claim all claimable fee positions')
  .option('--wallet <address>', 'Wallet address (defaults to configured key)')
  .option('--dry-run', 'Build and sign txs without submitting')
  .action(
    withErrorHandler(async (opts, cmd) => {
      const isJson = cmd.optsWithGlobals().json;
      const sdk = getSDK();
      const wallet = opts.wallet
        ? new PublicKey(opts.wallet)
        : getWalletPublicKey();

      spin('Fetching claimable positions...');
      const positions = await sdk.fee.getAllClaimablePositions(wallet);
      succeed();

      if (positions.length === 0) {
        console.log(t.dim('No claimable positions found.'));
        return;
      }

      const total = positions.reduce(
        (sum, p) => sum + p.totalClaimableLamportsUserShare,
        0,
      );
      console.log(
        t.info(
          `Found ${positions.length} position(s), total ${lamportsToSol(total).toFixed(6)} SOL`,
        ),
      );

      const signatures: string[] = [];

      for (let i = 0; i < positions.length; i++) {
        const pos = positions[i];
        const label = `claim ${i + 1}/${positions.length}`;

        spin(`Building ${label}...`);
        const txs = await sdk.fee.getClaimTransaction(wallet, pos);
        succeed();

        for (let j = 0; j < txs.length; j++) {
          const txLabel =
            txs.length > 1 ? `${label} (tx ${j + 1}/${txs.length})` : label;
          const sig = await signAndSendLegacy(txs[j], {
            dryRun: opts.dryRun,
            label: txLabel,
          });
          signatures.push(sig);
        }
      }

      if (isJson) {
        jsonOut({ signatures, positionsClaimed: positions.length });
      } else if (!opts.dryRun) {
        console.log(
          t.success(
            `\nClaimed ${positions.length} position(s) across ${signatures.length} transaction(s).`,
          ),
        );
      }
    }),
  );
