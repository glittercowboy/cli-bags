import { Command } from 'commander';
import { t } from '../output/theme.js';
import { table, jsonOut, redact } from '../output/format.js';
import { spin, succeed } from '../output/spinner.js';
import { withErrorHandler } from '../utils/error.js';
import { listApiKeys, createApiKey } from '../sdk/raw-api.js';

export const keysCommand = new Command('keys').description(
  'API key management',
);

keysCommand
  .command('list')
  .description('List all API keys')
  .action(
    withErrorHandler(async (_, cmd) => {
      const isJson = cmd.optsWithGlobals().json;

      spin('Fetching API keys...');
      const keys = await listApiKeys();
      succeed();

      if (isJson) {
        jsonOut(keys);
        return;
      }

      if (keys.length === 0) {
        console.log(t.dim('No API keys found.'));
        return;
      }

      console.log(
        table(
          ['Name', 'Key ID', 'Status', 'Last Used', 'Created'],
          keys.map((k) => [
            k.name,
            k.keyId,
            k.status,
            k.lastUsedAt ?? 'never',
            new Date(k.createdAt).toLocaleDateString(),
          ]),
        ),
      );
    }),
  );

keysCommand
  .command('create')
  .description('Create a new API key')
  .requiredOption('--name <name>', 'Key name')
  .action(
    withErrorHandler(async (opts, cmd) => {
      const isJson = cmd.optsWithGlobals().json;

      spin('Creating API key...');
      const key = await createApiKey(opts.name);
      succeed();

      if (isJson) {
        jsonOut(key);
        return;
      }

      console.log(t.title('\nAPI Key Created\n'));
      console.log(t.warn('Save this key — it will not be shown again:\n'));
      console.log(`  ${t.success(key.key ?? 'n/a')}\n`);
      console.log(
        t.dim(`Key ID: ${key.keyId}`),
      );
      console.log(
        t.dim(
          '\nTo use: bags config set api-key <key>',
        ),
      );
    }),
  );
