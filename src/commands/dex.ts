import { Command } from 'commander';
import { PublicKey } from '@solana/web3.js';
import { getSDK } from '../sdk/client.js';
import { t } from '../output/theme.js';
import { kv, jsonOut } from '../output/format.js';
import { spin, succeed } from '../output/spinner.js';
import { withErrorHandler } from '../utils/error.js';
import { getWalletPublicKey } from '../crypto/keypair.js';
import { signAndSend } from '../crypto/signer.js';

export const dexCommand = new Command('dex').description(
  'Dexscreener operations',
);

dexCommand
  .command('check')
  .description('Check Dexscreener order availability for a token')
  .requiredOption('--mint <address>', 'Token mint address')
  .action(
    withErrorHandler(async (opts, cmd) => {
      const isJson = cmd.optsWithGlobals().json;
      const sdk = getSDK();

      spin('Checking availability...');
      const result = await sdk.dexscreener.checkOrderAvailability({
        tokenAddress: new PublicKey(opts.mint),
      });
      succeed();

      if (isJson) {
        jsonOut(result);
        return;
      }

      console.log(
        kv([
          ['Token', opts.mint],
          [
            'Available',
            result.available ? t.success('Yes') : t.error('No'),
          ],
        ]),
      );
    }),
  );

dexCommand
  .command('order')
  .description('Create a Dexscreener order')
  .requiredOption('--mint <address>', 'Token mint address')
  .requiredOption('--description <text>', 'Token description')
  .requiredOption('--icon-url <url>', 'Icon image URL')
  .requiredOption('--header-url <url>', 'Header image URL')
  .option('--links <json>', 'JSON array: [{"url":"...","label":"..."}]')
  .option('--pay-with-sol', 'Pay with SOL instead of USDC')
  .option('--dry-run', 'Build tx without submitting')
  .action(
    withErrorHandler(async (opts, cmd) => {
      const isJson = cmd.optsWithGlobals().json;
      const sdk = getSDK();
      const wallet = getWalletPublicKey();

      const links = opts.links
        ? (JSON.parse(opts.links) as Array<{ url: string; label?: string }>)
        : undefined;

      spin('Creating Dexscreener order...');
      const order = await sdk.dexscreener.createOrder({
        tokenAddress: new PublicKey(opts.mint),
        description: opts.description,
        iconImageUrl: opts.iconUrl,
        headerImageUrl: opts.headerUrl,
        payerWallet: wallet,
        links,
        payWithSol: opts.payWithSol ?? false,
      });
      succeed();

      if (isJson) {
        jsonOut(order);
        return;
      }

      console.log(t.title('\nDexscreener Order Created\n'));
      console.log(
        kv([
          ['Order UUID', order.orderUUID],
          ['Recipient', order.recipientWallet],
          ['Price (USDC)', String(order.priceUSDC)],
        ]),
      );
      console.log(
        t.warn(
          '\nTo complete payment, sign and send the order transaction,',
        ),
      );
      console.log(
        t.warn(
          'then run: bags dex pay --order-uuid <uuid> --signature <sig>',
        ),
      );
    }),
  );

dexCommand
  .command('pay')
  .description('Submit Dexscreener payment')
  .requiredOption('--order-uuid <uuid>', 'Order UUID from dex order')
  .requiredOption('--signature <sig>', 'Payment transaction signature')
  .action(
    withErrorHandler(async (opts, cmd) => {
      const isJson = cmd.optsWithGlobals().json;
      const sdk = getSDK();

      spin('Submitting payment...');
      const result = await sdk.dexscreener.submitPayment({
        orderUUID: opts.orderUuid,
        paymentSignature: opts.signature,
      });
      succeed();

      if (isJson) {
        jsonOut({ result });
        return;
      }

      console.log(t.success('Payment submitted successfully.'));
    }),
  );
