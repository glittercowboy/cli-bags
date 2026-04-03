import { Command } from 'commander';
import { VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { getRawClient } from '../sdk/client.js';
import { t } from '../output/theme.js';
import { table, kv, jsonOut } from '../output/format.js';
import { spin, succeed } from '../output/spinner.js';
import { withErrorHandler } from '../utils/error.js';
import { getWalletPublicKey } from '../crypto/keypair.js';
import { signAndSend } from '../crypto/signer.js';

export const incorporateCommand = new Command('incorporate').description(
  'Token incorporation and compliance',
);

incorporateCommand
  .command('start-payment')
  .description('Initiate incorporation payment')
  .option('--pay-with-sol', 'Pay with SOL instead of USDC')
  .option('--dry-run', 'Build tx without submitting')
  .action(
    withErrorHandler(async (opts, cmd) => {
      const isJson = cmd.optsWithGlobals().json;
      const client = getRawClient();
      const wallet = getWalletPublicKey();

      spin('Creating incorporation payment...');
      const result = await client.post<{
        orderUUID: string;
        recipientWallet: string;
        priceUSDC: string;
        transaction: string;
        lastValidBlockHeight: number;
      }>('/incorporate/start-payment', {
        payerWallet: wallet.toBase58(),
        payWithSol: opts.payWithSol ?? false,
      });
      succeed();

      if (isJson) {
        jsonOut(result);
        return;
      }

      console.log(t.title('\nIncorporation Payment\n'));
      console.log(
        kv([
          ['Order UUID', result.orderUUID],
          ['Recipient', result.recipientWallet],
          ['Price (USDC)', result.priceUSDC],
        ]),
      );

      // Sign and send the payment transaction
      const txBytes = bs58.decode(result.transaction);
      const tx = VersionedTransaction.deserialize(txBytes);

      const sig = await signAndSend(tx, {
        dryRun: opts.dryRun,
        label: 'incorporation payment',
      });

      if (!opts.dryRun) {
        console.log(
          t.success(
            `\nPayment submitted. Use the order UUID to submit incorporation details.`,
          ),
        );
      }
    }),
  );

incorporateCommand
  .command('submit')
  .description('Submit incorporation details after payment')
  .requiredOption('--details <json>', 'Incorporation details as JSON (founders, company names, category)')
  .action(
    withErrorHandler(async (opts, cmd) => {
      const isJson = cmd.optsWithGlobals().json;
      const client = getRawClient();
      const details = JSON.parse(opts.details);

      spin('Submitting incorporation details...');
      const result = await client.post<any>('/incorporate', details);
      succeed();

      if (isJson) {
        jsonOut(result);
        return;
      }

      console.log(t.success('Incorporation details submitted.'));
      if (result && typeof result === 'object') {
        console.log(kv(Object.entries(result).map(([k, v]) => [k, String(v)])));
      }
    }),
  );

incorporateCommand
  .command('start')
  .description('Trigger the incorporation process for a token')
  .requiredOption('--token <address>', 'Token mint address')
  .action(
    withErrorHandler(async (opts, cmd) => {
      const isJson = cmd.optsWithGlobals().json;
      const client = getRawClient();

      spin('Starting incorporation process...');
      const result = await client.post<any>('/incorporate/start', {
        tokenMint: opts.token,
      });
      succeed();

      if (isJson) {
        jsonOut(result);
        return;
      }

      console.log(t.success('Incorporation process started.'));
      if (result && typeof result === 'object') {
        console.log(kv(Object.entries(result).map(([k, v]) => [k, String(v)])));
      }
    }),
  );

incorporateCommand
  .command('details')
  .description('Get incorporation project details')
  .requiredOption('--token <address>', 'Token mint address')
  .action(
    withErrorHandler(async (opts, cmd) => {
      const isJson = cmd.optsWithGlobals().json;
      const client = getRawClient();

      spin('Fetching incorporation details...');
      const result = await client.get<any>('/incorporate/details', {
        params: { tokenMint: opts.token },
      });
      succeed();

      if (isJson) {
        jsonOut(result);
        return;
      }

      if (!result) {
        console.log(t.dim('No incorporation project found for this token.'));
        return;
      }

      console.log(kv(Object.entries(result).map(([k, v]) => [k, String(v)])));
    }),
  );

incorporateCommand
  .command('list')
  .description('List all incorporation projects')
  .action(
    withErrorHandler(async (_, cmd) => {
      const isJson = cmd.optsWithGlobals().json;
      const client = getRawClient();

      spin('Fetching incorporation projects...');
      const projects = await client.get<any[]>('/incorporate/list');
      succeed();

      if (isJson) {
        jsonOut(projects);
        return;
      }

      if (!projects || projects.length === 0) {
        console.log(t.dim('No incorporation projects found.'));
        return;
      }

      console.log(
        table(
          Object.keys(projects[0]),
          projects.map((p) => Object.values(p).map(String)),
        ),
      );
    }),
  );
