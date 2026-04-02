import { Command } from 'commander';
import { t } from '../output/theme.js';
import { kv, jsonOut } from '../output/format.js';
import { spin, succeed } from '../output/spinner.js';
import { withErrorHandler } from '../utils/error.js';
import { authInit, authLogin } from '../sdk/raw-api.js';
import { loadConfig, saveConfig } from '../config/store.js';

export const authCommand = new Command('auth').description(
  'Agent authentication (Moltbook-based)',
);

authCommand
  .command('init')
  .description('Start authentication flow')
  .requiredOption('--username <moltbook>', 'Moltbook username')
  .action(
    withErrorHandler(async (opts, cmd) => {
      const isJson = cmd.optsWithGlobals().json;

      spin('Initializing auth...');
      const result = await authInit(opts.username);
      succeed();

      if (isJson) {
        jsonOut(result);
        return;
      }

      console.log(t.title('\nAuthentication Initialized\n'));
      console.log(
        kv([
          ['Identifier', result.publicIdentifier],
          ['Secret', result.secret],
          ['Username', result.agentUsername],
        ]),
      );
      console.log(t.warn('\nPost the following content on Moltbook:\n'));
      console.log(`  ${t.info(result.verificationPostContent)}\n`);
      console.log(
        t.dim(
          'Then run: bags auth login --identifier <id> --secret <secret> --post-id <postId>',
        ),
      );
      console.log(t.dim('Session expires in 15 minutes.\n'));
    }),
  );

authCommand
  .command('login')
  .description('Complete authentication with Moltbook post')
  .requiredOption('--identifier <id>', 'Public identifier from auth init')
  .requiredOption('--secret <secret>', 'Secret from auth init')
  .requiredOption('--post-id <postId>', 'Moltbook post ID with verification content')
  .action(
    withErrorHandler(async (opts, cmd) => {
      const isJson = cmd.optsWithGlobals().json;

      spin('Completing authentication...');
      const result = await authLogin(
        opts.identifier,
        opts.secret,
        opts.postId,
      );
      succeed();

      // Store JWT
      const config = loadConfig();
      config.auth = {
        jwt: result.token,
        expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
      };
      saveConfig(config);

      if (isJson) {
        jsonOut({ authenticated: true });
        return;
      }

      console.log(t.success('\nAuthenticated! JWT stored in ~/.bags/config.json'));
      console.log(t.dim('Valid for 365 days.\n'));
    }),
  );
