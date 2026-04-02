import { Command } from 'commander';
import { PublicKey } from '@solana/web3.js';
import { getSDK } from '../sdk/client.js';
import { t } from '../output/theme.js';
import { table, kv, jsonOut } from '../output/format.js';
import { spin, succeed } from '../output/spinner.js';
import { withErrorHandler } from '../utils/error.js';
import { shortenAddress } from '../utils/solana.js';
import { getWalletPublicKey } from '../crypto/keypair.js';
import { signAndSend, signAndSendBundle } from '../crypto/signer.js';
import type { SupportedSocialProvider } from '@bagsfm/bags-sdk';

export const feeShareCommand = new Command('fee-share').description(
  'Fee share configuration and lookups',
);

feeShareCommand
  .command('list')
  .description('List tokens where wallet is fee share admin')
  .option('--wallet <address>', 'Admin wallet (defaults to configured key)')
  .action(
    withErrorHandler(async (opts, cmd) => {
      const isJson = cmd.optsWithGlobals().json;
      const sdk = getSDK();
      const wallet = opts.wallet
        ? new PublicKey(opts.wallet)
        : getWalletPublicKey();

      spin('Fetching admin tokens...');
      const mints = await sdk.feeShareAdmin.getAdminTokenMints(wallet);
      succeed();

      if (isJson) {
        jsonOut(mints);
        return;
      }

      if (mints.length === 0) {
        console.log(t.dim('No tokens found where this wallet is admin.'));
        return;
      }

      console.log(t.title(`\nAdmin for ${mints.length} token(s):\n`));
      for (const mint of mints) {
        console.log(`  ${t.mint(mint)}`);
      }
      console.log();
    }),
  );

feeShareCommand
  .command('lookup')
  .description('Lookup fee share wallet by social username')
  .requiredOption('--username <name>', 'Social platform username')
  .requiredOption(
    '--provider <provider>',
    'Social provider: twitter, tiktok, kick, github',
  )
  .action(
    withErrorHandler(async (opts, cmd) => {
      const isJson = cmd.optsWithGlobals().json;
      const sdk = getSDK();

      spin('Looking up wallet...');
      const result = await sdk.state.getLaunchWalletV2(
        opts.username,
        opts.provider as SupportedSocialProvider,
      );
      succeed();

      if (isJson) {
        jsonOut({
          provider: result.provider,
          platformData: result.platformData,
          wallet: result.wallet.toBase58(),
        });
        return;
      }

      console.log(
        kv([
          ['Provider', result.provider],
          ['Username', result.platformData.username],
          ['Display Name', result.platformData.display_name],
          ['Wallet', result.wallet.toBase58()],
        ]),
      );
    }),
  );

feeShareCommand
  .command('lookup-bulk')
  .description('Bulk lookup fee share wallets')
  .requiredOption(
    '--items <json>',
    'JSON array: [{"username":"...","provider":"twitter"}]',
  )
  .action(
    withErrorHandler(async (opts, cmd) => {
      const isJson = cmd.optsWithGlobals().json;
      const sdk = getSDK();
      const items = JSON.parse(opts.items) as Array<{
        username: string;
        provider: string;
      }>;

      spin(`Looking up ${items.length} wallet(s)...`);
      const results = await sdk.state.getLaunchWalletV2Bulk(
        items.map((i) => ({
          username: i.username,
          provider: i.provider as SupportedSocialProvider,
        })),
      );
      succeed();

      if (isJson) {
        jsonOut(
          results.map((r) => ({
            ...r,
            wallet: r.wallet?.toBase58() ?? null,
          })),
        );
        return;
      }

      console.log(
        table(
          ['Username', 'Provider', 'Wallet'],
          results.map((r) => [
            r.username,
            r.provider,
            r.wallet?.toBase58() ?? t.dim('not found'),
          ]),
        ),
      );
    }),
  );

feeShareCommand
  .command('create')
  .description('Create fee share config for a token')
  .requiredOption('--mint <address>', 'Token mint address')
  .requiredOption(
    '--claimers <json>',
    'JSON array: [{"wallet":"...","bps":5000}]',
  )
  .option('--partner <address>', 'Partner wallet address')
  .option('--tip <lamports>', 'Jito tip in lamports')
  .option('--dry-run', 'Build txs without submitting')
  .action(
    withErrorHandler(async (opts, cmd) => {
      const isJson = cmd.optsWithGlobals().json;
      const sdk = getSDK();
      const wallet = getWalletPublicKey();
      const claimers = JSON.parse(opts.claimers) as Array<{
        wallet: string;
        bps: number;
      }>;

      spin('Creating fee share config...');
      const result = await sdk.config.createBagsFeeShareConfig(
        {
          feeClaimers: claimers.map((c) => ({
            user: new PublicKey(c.wallet),
            userBps: c.bps,
          })),
          payer: wallet,
          baseMint: new PublicKey(opts.mint),
          partner: opts.partner ? new PublicKey(opts.partner) : undefined,
        },
        opts.tip
          ? { tipWallet: wallet, tipLamports: parseInt(opts.tip) }
          : undefined,
      );
      succeed(`Config key: ${result.meteoraConfigKey.toBase58()}`);

      if (result.bundles.length > 0) {
        for (const bundle of result.bundles) {
          await signAndSendBundle(bundle, { dryRun: opts.dryRun });
        }
      }
      for (const tx of result.transactions) {
        await signAndSend(tx, { dryRun: opts.dryRun, label: 'fee share config' });
      }

      if (isJson) {
        jsonOut({ configKey: result.meteoraConfigKey.toBase58() });
      }
    }),
  );

feeShareCommand
  .command('update')
  .description('Update fee share config')
  .requiredOption('--mint <address>', 'Token mint address')
  .requiredOption(
    '--claimers <json>',
    'JSON array: [{"wallet":"...","bps":5000}]',
  )
  .option('--dry-run', 'Build txs without submitting')
  .action(
    withErrorHandler(async (opts, cmd) => {
      const isJson = cmd.optsWithGlobals().json;
      const sdk = getSDK();
      const wallet = getWalletPublicKey();
      const claimers = JSON.parse(opts.claimers) as Array<{
        wallet: string;
        bps: number;
      }>;

      spin('Building update transactions...');
      const txPairs = await sdk.feeShareAdmin.getUpdateConfigTransactions({
        feeClaimers: claimers.map((c) => ({
          user: new PublicKey(c.wallet),
          userBps: c.bps,
        })),
        payer: wallet,
        baseMint: new PublicKey(opts.mint),
      });
      succeed();

      for (let i = 0; i < txPairs.length; i++) {
        await signAndSend(txPairs[i].transaction, {
          dryRun: opts.dryRun,
          label: `update config ${i + 1}/${txPairs.length}`,
        });
      }

      if (isJson) {
        jsonOut({ transactionCount: txPairs.length });
      } else if (!opts.dryRun) {
        console.log(
          t.success(`\nFee share config updated in ${txPairs.length} transaction(s).`),
        );
      }
    }),
  );

feeShareCommand
  .command('transfer')
  .description('Transfer fee share admin to a new wallet')
  .requiredOption('--mint <address>', 'Token mint address')
  .requiredOption('--new-admin <address>', 'New admin wallet address')
  .option('--dry-run', 'Build tx without submitting')
  .action(
    withErrorHandler(async (opts, cmd) => {
      const isJson = cmd.optsWithGlobals().json;
      const sdk = getSDK();
      const wallet = getWalletPublicKey();

      spin('Building transfer admin transaction...');
      const { transaction } =
        await sdk.feeShareAdmin.getTransferAdminTransaction({
          baseMint: new PublicKey(opts.mint),
          currentAdmin: wallet,
          newAdmin: new PublicKey(opts.newAdmin),
          payer: wallet,
        });
      succeed();

      const sig = await signAndSend(transaction, {
        dryRun: opts.dryRun,
        label: 'transfer admin',
      });

      if (isJson && !opts.dryRun) {
        jsonOut({ signature: sig });
      }
    }),
  );
