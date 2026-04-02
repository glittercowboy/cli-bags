import { Command } from 'commander';
import { t } from '../output/theme.js';
import { jsonOut } from '../output/format.js';
import { spin, succeed } from '../output/spinner.js';
import { withErrorHandler } from '../utils/error.js';
import { listWallets, exportWallet } from '../sdk/raw-api.js';
import { confirm } from '../utils/prompts.js';

export const walletCommand = new Command('wallet').description(
  'Wallet management',
);

walletCommand
  .command('list')
  .description('List associated wallets')
  .action(
    withErrorHandler(async (_, cmd) => {
      const isJson = cmd.optsWithGlobals().json;

      spin('Fetching wallets...');
      const wallets = await listWallets();
      succeed();

      if (isJson) {
        jsonOut(wallets);
        return;
      }

      if (wallets.length === 0) {
        console.log(t.dim('No wallets found.'));
        return;
      }

      console.log(t.title(`\n${wallets.length} wallet(s):\n`));
      for (const w of wallets) {
        console.log(`  ${t.address(w)}`);
      }
      console.log();
    }),
  );

walletCommand
  .command('export')
  .description('Export wallet private key')
  .requiredOption('--address <address>', 'Wallet address to export')
  .action(
    withErrorHandler(async (opts, cmd) => {
      const isJson = cmd.optsWithGlobals().json;

      const confirmed = await confirm({
        message: t.warn(
          'This will display your private key. Are you sure?',
        ),
        default: false,
      });

      if (!confirmed) {
        console.log(t.dim('Cancelled.'));
        return;
      }

      spin('Exporting wallet...');
      const result = await exportWallet(opts.address);
      succeed();

      if (isJson) {
        jsonOut(result);
        return;
      }

      console.log(t.warn('\nPrivate Key (keep this secret!):\n'));
      console.log(`  ${result.privateKey}\n`);
    }),
  );
