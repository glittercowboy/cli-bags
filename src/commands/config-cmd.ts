import { Command } from 'commander';
import { t } from '../output/theme.js';
import { kv, redact, jsonOut } from '../output/format.js';
import { withErrorHandler } from '../utils/error.js';
import {
  loadConfig,
  saveConfig,
  getActiveProfile,
  setConfigValue,
} from '../config/store.js';
import { input, select } from '../utils/prompts.js';

export const configCommand = new Command('config').description(
  'Manage CLI configuration',
);

configCommand
  .command('show')
  .description('Show current configuration')
  .action(
    withErrorHandler(async (_, cmd) => {
      const isJson = cmd.optsWithGlobals().json;
      const profile = getActiveProfile();

      if (isJson) {
        jsonOut({
          profile: profile.name,
          apiKey: profile.apiKey ? redact(profile.apiKey) : null,
          rpcUrl: profile.rpcUrl ?? null,
          privateKey: profile.privateKey ? redact(profile.privateKey) : null,
          commitment: profile.commitment,
        });
        return;
      }

      console.log(t.title(`\nProfile: ${profile.name}\n`));
      console.log(
        kv([
          ['API Key', profile.apiKey ? redact(profile.apiKey) : 'not set'],
          ['RPC URL', profile.rpcUrl ?? 'not set'],
          [
            'Private Key',
            profile.privateKey ? redact(profile.privateKey) : 'not set',
          ],
          ['Commitment', profile.commitment],
        ]),
      );
      console.log();
    }),
  );

configCommand
  .command('set')
  .description('Set a configuration value')
  .argument('<key>', 'Config key: api-key, rpc-url, private-key, commitment, active-profile')
  .argument('<value>', 'Value to set')
  .action(
    withErrorHandler(async (key: string, value: string) => {
      setConfigValue(key, value);
      console.log(t.success(`Set ${key} successfully.`));
    }),
  );

configCommand
  .command('init')
  .description('Interactive setup wizard')
  .action(
    withErrorHandler(async () => {
      console.log(t.title('\nBags CLI Setup\n'));

      const apiKey = await input({
        message: 'API key (from dev.bags.fm):',
      });

      const rpcUrl = await input({
        message: 'Solana RPC URL:',
        default: 'https://api.mainnet-beta.solana.com',
      });

      const commitment = await select({
        message: 'Commitment level:',
        choices: [
          { value: 'confirmed', name: 'confirmed (recommended)' },
          { value: 'finalized', name: 'finalized (slower, safer)' },
          { value: 'processed', name: 'processed (fastest, risky)' },
        ],
        default: 'confirmed',
      });

      const privateKey = await input({
        message: 'Private key (base58, optional — needed for signing):',
        default: '',
      });

      const config = loadConfig();
      config.profiles['default'] = {
        apiKey: apiKey || undefined,
        rpcUrl,
        commitment: commitment as 'confirmed' | 'finalized' | 'processed',
        privateKey: privateKey || undefined,
      };
      config.activeProfile = 'default';
      saveConfig(config);

      console.log(t.success('\nConfiguration saved to ~/.bags/config.json'));
    }),
  );
