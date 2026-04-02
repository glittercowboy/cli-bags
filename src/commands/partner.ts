import { Command } from 'commander';
import { PublicKey } from '@solana/web3.js';
import { getSDK } from '../sdk/client.js';
import { t } from '../output/theme.js';
import { kv, jsonOut } from '../output/format.js';
import { spin, succeed } from '../output/spinner.js';
import { withErrorHandler } from '../utils/error.js';
import { lamportsToSol } from '../utils/solana.js';
import { getWalletPublicKey } from '../crypto/keypair.js';
import { signAndSend } from '../crypto/signer.js';

export const partnerCommand = new Command('partner').description(
  'Partner program operations',
);

partnerCommand
  .command('config')
  .description('Get partner configuration')
  .option('--wallet <address>', 'Partner wallet (defaults to configured key)')
  .action(
    withErrorHandler(async (opts, cmd) => {
      const isJson = cmd.optsWithGlobals().json;
      const sdk = getSDK();
      const wallet = opts.wallet
        ? new PublicKey(opts.wallet)
        : getWalletPublicKey();

      spin('Fetching partner config...');
      const config = await sdk.partner.getPartnerConfig(wallet);
      succeed();

      if (isJson) {
        jsonOut(config);
        return;
      }

      console.log(kv(Object.entries(config).map(([k, v]) => [k, String(v)])));
    }),
  );

partnerCommand
  .command('stats')
  .description('Partner fee statistics')
  .option('--wallet <address>', 'Partner wallet (defaults to configured key)')
  .action(
    withErrorHandler(async (opts, cmd) => {
      const isJson = cmd.optsWithGlobals().json;
      const sdk = getSDK();
      const wallet = opts.wallet
        ? new PublicKey(opts.wallet)
        : getWalletPublicKey();

      spin('Fetching partner stats...');
      const stats = await sdk.partner.getPartnerConfigClaimStats(wallet);
      succeed();

      if (isJson) {
        jsonOut(stats);
        return;
      }

      console.log(
        kv([
          ['Claimed Fees', `${lamportsToSol(stats.claimedFees).toFixed(6)} SOL`],
          [
            'Unclaimed Fees',
            `${lamportsToSol(stats.unclaimedFees).toFixed(6)} SOL`,
          ],
        ]),
      );
    }),
  );

partnerCommand
  .command('create')
  .description('Create partner configuration')
  .option('--dry-run', 'Build and sign tx without submitting')
  .action(
    withErrorHandler(async (opts, cmd) => {
      const isJson = cmd.optsWithGlobals().json;
      const sdk = getSDK();
      const wallet = getWalletPublicKey();

      spin('Building partner config transaction...');
      const { transaction } =
        await sdk.partner.getPartnerConfigCreationTransaction(wallet);
      succeed();

      const sig = await signAndSend(transaction, {
        dryRun: opts.dryRun,
        label: 'partner config creation',
      });

      if (isJson && !opts.dryRun) {
        jsonOut({ signature: sig });
      }
    }),
  );

partnerCommand
  .command('claim')
  .description('Claim partner fees')
  .option('--dry-run', 'Build and sign txs without submitting')
  .action(
    withErrorHandler(async (opts, cmd) => {
      const isJson = cmd.optsWithGlobals().json;
      const sdk = getSDK();
      const wallet = getWalletPublicKey();

      spin('Building partner claim transactions...');
      const txPairs =
        await sdk.partner.getPartnerConfigClaimTransactions(wallet);
      succeed();

      if (txPairs.length === 0) {
        console.log(t.dim('No partner fees to claim.'));
        return;
      }

      const signatures: string[] = [];
      for (let i = 0; i < txPairs.length; i++) {
        const sig = await signAndSend(txPairs[i].transaction, {
          dryRun: opts.dryRun,
          label: `partner claim ${i + 1}/${txPairs.length}`,
        });
        signatures.push(sig);
      }

      if (isJson) {
        jsonOut({ signatures });
      } else if (!opts.dryRun) {
        console.log(
          t.success(`\nClaimed partner fees in ${signatures.length} transaction(s).`),
        );
      }
    }),
  );
