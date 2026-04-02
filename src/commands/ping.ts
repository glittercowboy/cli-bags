import { Command } from 'commander';
import { t } from '../output/theme.js';
import { spin, succeed, fail } from '../output/spinner.js';
import { withErrorHandler } from '../utils/error.js';
import { getActiveProfile } from '../config/store.js';

const PING_URL = 'https://public-api-v2.bags.fm/ping';

export const pingCommand = new Command('ping')
  .description('Health check against the Bags API')
  .action(
    withErrorHandler(async () => {
      const profile = getActiveProfile();
      spin('Pinging Bags API...');

      const start = Date.now();
      const res = await fetch(PING_URL, {
        headers: profile.apiKey ? { 'x-api-key': profile.apiKey } : {},
      });
      const elapsed = Date.now() - start;

      if (res.ok) {
        succeed(t.success(`Bags API is up (${elapsed}ms)`));
      } else {
        fail(t.error(`Bags API returned ${res.status} (${elapsed}ms)`));
      }
    }),
  );
