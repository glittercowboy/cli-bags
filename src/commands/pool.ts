import { Command } from 'commander';
import { PublicKey } from '@solana/web3.js';
import { getSDK, getRawClient } from '../sdk/client.js';
import { t } from '../output/theme.js';
import { table, kv, jsonOut } from '../output/format.js';
import { spin, succeed } from '../output/spinner.js';
import { withErrorHandler } from '../utils/error.js';
import { lamportsToSol, shortenAddress } from '../utils/solana.js';

export const poolCommand = new Command('pool').description(
  'Pool and market data',
);

poolCommand
  .command('leaderboard')
  .description('Top tokens by lifetime fees')
  .action(
    withErrorHandler(async (_, cmd) => {
      const isJson = cmd.optsWithGlobals().json;
      const sdk = getSDK();

      spin('Fetching leaderboard...');
      const items = await sdk.state.getTopTokensByLifetimeFees();
      succeed();

      if (isJson) {
        jsonOut(items);
        return;
      }

      if (items.length === 0) {
        console.log(t.dim('No pools found.'));
        return;
      }

      console.log(
        table(
          ['#', 'Token', 'Symbol', 'Lifetime Fees (SOL)', 'Price (USD)'],
          items.map((item, i) => [
            i + 1,
            item.tokenInfo?.name ?? shortenAddress(item.token),
            item.tokenInfo?.symbol ?? '-',
            lamportsToSol(item.lifetimeFees).toFixed(4),
            item.tokenLatestPrice?.priceUSD?.toFixed(6) ?? '-',
          ]),
        ),
      );
    }),
  );

poolCommand
  .command('config')
  .description('Get pool config keys by fee claimer vaults')
  .requiredOption('--vaults <addresses>', 'Comma-separated vault addresses')
  .action(
    withErrorHandler(async (opts, cmd) => {
      const isJson = cmd.optsWithGlobals().json;
      const sdk = getSDK();
      const vaults = (opts.vaults as string)
        .split(',')
        .map((a: string) => new PublicKey(a.trim()));

      spin('Fetching pool config keys...');
      const keys = await sdk.state.getPoolConfigKeysByFeeClaimerVaults(vaults);
      succeed();

      if (isJson) {
        jsonOut(keys.map((k) => k.toBase58()));
        return;
      }

      console.log(
        table(
          ['Vault', 'Pool Config Key'],
          vaults.map((v, i) => [
            shortenAddress(v.toBase58()),
            keys[i]?.toBase58() ?? t.dim('none'),
          ]),
        ),
      );
    }),
  );

poolCommand
  .command('list')
  .description('List all Bags pools')
  .option('--migrated', 'Only show pools migrated to DAMM v2')
  .action(
    withErrorHandler(async (opts, cmd) => {
      const isJson = cmd.optsWithGlobals().json;
      const client = getRawClient();

      spin('Fetching pools...');
      const pools = await client.get<
        Array<{
          tokenMint: string;
          dbcConfigKey: string;
          dbcPoolKey: string;
          dammV2PoolKey: string | null;
        }>
      >('/solana/bags/pools', {
        params: { onlyMigrated: opts.migrated ?? false },
      });
      succeed();

      if (isJson) {
        jsonOut(pools);
        return;
      }

      if (pools.length === 0) {
        console.log(t.dim('No pools found.'));
        return;
      }

      console.log(
        table(
          ['Token Mint', 'DBC Pool', 'DAMM v2 Pool', 'Migrated'],
          pools.map((p) => [
            shortenAddress(p.tokenMint),
            shortenAddress(p.dbcPoolKey),
            p.dammV2PoolKey ? shortenAddress(p.dammV2PoolKey) : '-',
            p.dammV2PoolKey ? 'Yes' : 'No',
          ]),
        ),
      );
      console.log(t.dim(`\n${pools.length} pool(s) total`));
    }),
  );

poolCommand
  .command('info')
  .description('Get pool info for a specific token')
  .requiredOption('--mint <address>', 'Token mint address')
  .action(
    withErrorHandler(async (opts, cmd) => {
      const isJson = cmd.optsWithGlobals().json;
      const client = getRawClient();

      spin('Fetching pool info...');
      const pool = await client.get<{
        tokenMint: string;
        dbcConfigKey: string;
        dbcPoolKey: string;
        dammV2PoolKey: string | null;
      }>('/solana/bags/pools/token-mint', {
        params: { tokenMint: opts.mint },
      });
      succeed();

      if (isJson) {
        jsonOut(pool);
        return;
      }

      console.log(
        kv([
          ['Token Mint', pool.tokenMint],
          ['DBC Config Key', pool.dbcConfigKey],
          ['DBC Pool Key', pool.dbcPoolKey],
          ['DAMM v2 Pool Key', pool.dammV2PoolKey ?? 'not migrated'],
        ]),
      );
    }),
  );
