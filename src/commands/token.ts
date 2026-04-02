import { Command } from 'commander';
import { Keypair, PublicKey } from '@solana/web3.js';
import { readFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { getSDK } from '../sdk/client.js';
import { t } from '../output/theme.js';
import { table, kv, jsonOut } from '../output/format.js';
import { spin, succeed } from '../output/spinner.js';
import { withErrorHandler } from '../utils/error.js';
import { lamportsToSol, shortenAddress, solToLamports } from '../utils/solana.js';
import { signAndSend, signAndSendBundle } from '../crypto/signer.js';
import { loadKeypair, getWalletPublicKey } from '../crypto/keypair.js';
import type { CreateTokenInfoParams } from '@bagsfm/bags-sdk/dist/types/token-launch.js';

export const tokenCommand = new Command('token').description(
  'Token launch operations',
);

tokenCommand
  .command('creators')
  .description('List token creators')
  .requiredOption('--mint <address>', 'Token mint address')
  .action(
    withErrorHandler(async (opts, cmd) => {
      const isJson = cmd.optsWithGlobals().json;
      const sdk = getSDK();

      spin('Fetching token creators...');
      const creators = await sdk.state.getTokenCreators(new PublicKey(opts.mint));
      succeed();

      if (isJson) {
        jsonOut(creators);
        return;
      }

      if (creators.length === 0) {
        console.log(t.dim('No creators found.'));
        return;
      }

      console.log(
        table(
          ['Username', 'Wallet', 'Royalty BPS', 'Provider', 'Creator', 'Admin'],
          creators.map((c) => [
            c.username || '-',
            shortenAddress(c.wallet),
            c.royaltyBps,
            c.provider ?? '-',
            c.isCreator ? 'Yes' : 'No',
            c.isAdmin ? 'Yes' : 'No',
          ]),
        ),
      );
    }),
  );

tokenCommand
  .command('fees')
  .description('Get lifetime fees for a token')
  .requiredOption('--mint <address>', 'Token mint address')
  .action(
    withErrorHandler(async (opts, cmd) => {
      const isJson = cmd.optsWithGlobals().json;
      const sdk = getSDK();

      spin('Fetching lifetime fees...');
      const fees = await sdk.state.getTokenLifetimeFees(new PublicKey(opts.mint));
      succeed();

      if (isJson) {
        jsonOut({ mint: opts.mint, lifetimeFeesLamports: fees, lifetimeFeesSol: lamportsToSol(fees) });
        return;
      }

      console.log(
        kv([
          ['Mint', opts.mint],
          ['Lifetime Fees', `${lamportsToSol(fees)} SOL (${fees} lamports)`],
        ]),
      );
    }),
  );

tokenCommand
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
        console.log(t.dim('No tokens found.'));
        return;
      }

      console.log(
        table(
          ['#', 'Token', 'Symbol', 'Lifetime Fees (SOL)', 'Price (USD)', 'MCap'],
          items.map((item, i) => [
            i + 1,
            item.tokenInfo?.name ?? shortenAddress(item.token),
            item.tokenInfo?.symbol ?? '-',
            lamportsToSol(item.lifetimeFees).toFixed(4),
            item.tokenLatestPrice?.priceUSD?.toFixed(6) ?? '-',
            item.tokenInfo?.mcap
              ? `$${(item.tokenInfo.mcap / 1000).toFixed(1)}k`
              : '-',
          ]),
        ),
      );
    }),
  );

function mimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  const types: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };
  return types[ext] ?? 'application/octet-stream';
}

tokenCommand
  .command('info')
  .description('Create token info and metadata (no launch)')
  .requiredOption('--name <name>', 'Token name')
  .requiredOption('--symbol <symbol>', 'Token symbol')
  .requiredOption('--description <desc>', 'Token description')
  .option('--image <path>', 'Path to token image file')
  .option('--image-url <url>', 'URL of token image')
  .option('--twitter <handle>', 'Twitter handle')
  .option('--telegram <url>', 'Telegram URL')
  .option('--website <url>', 'Website URL')
  .action(
    withErrorHandler(async (opts, cmd) => {
      const isJson = cmd.optsWithGlobals().json;
      const sdk = getSDK();

      if (!opts.image && !opts.imageUrl) {
        throw new Error('Either --image or --image-url is required.');
      }

      let params: CreateTokenInfoParams;
      if (opts.image) {
        const buf = readFileSync(opts.image);
        params = {
          image: {
            value: buf,
            options: {
              filename: basename(opts.image),
              contentType: mimeType(opts.image),
            },
          },
          name: opts.name,
          symbol: opts.symbol,
          description: opts.description,
          twitter: opts.twitter,
          telegram: opts.telegram,
          website: opts.website,
        };
      } else {
        params = {
          imageUrl: opts.imageUrl,
          name: opts.name,
          symbol: opts.symbol,
          description: opts.description,
          twitter: opts.twitter,
          telegram: opts.telegram,
          website: opts.website,
        };
      }

      spin('Creating token info and metadata...');
      const result = await sdk.tokenLaunch.createTokenInfoAndMetadata(params);
      succeed();

      if (isJson) {
        jsonOut(result);
        return;
      }

      console.log(t.title('\nToken Created\n'));
      console.log(
        kv([
          ['Token Mint', result.tokenMint],
          ['Metadata URL', result.tokenMetadata],
          ['Name', result.tokenLaunch.name],
          ['Symbol', result.tokenLaunch.symbol],
          ['Status', result.tokenLaunch.status],
        ]),
      );
    }),
  );

tokenCommand
  .command('launch')
  .description('Full token launch flow: create info -> fee share config -> launch tx')
  .requiredOption('--name <name>', 'Token name')
  .requiredOption('--symbol <symbol>', 'Token symbol')
  .requiredOption('--description <desc>', 'Token description')
  .option('--image <path>', 'Path to token image file')
  .option('--image-url <url>', 'URL of token image')
  .requiredOption(
    '--claimers <json>',
    'JSON array: [{"wallet":"...","bps":5000}]',
  )
  .option('--initial-buy <sol>', 'Initial buy amount in SOL', '0')
  .option('--partner <address>', 'Partner wallet address')
  .option('--tip <lamports>', 'Jito tip in lamports')
  .option('--twitter <handle>', 'Twitter handle')
  .option('--telegram <url>', 'Telegram URL')
  .option('--website <url>', 'Website URL')
  .option('--dry-run', 'Build txs without submitting')
  .action(
    withErrorHandler(async (opts, cmd) => {
      const isJson = cmd.optsWithGlobals().json;
      const sdk = getSDK();
      const wallet = getWalletPublicKey();

      if (!opts.image && !opts.imageUrl) {
        throw new Error('Either --image or --image-url is required.');
      }

      // Step 1: Create token info
      let infoParams: CreateTokenInfoParams;
      if (opts.image) {
        const buf = readFileSync(opts.image);
        infoParams = {
          image: {
            value: buf,
            options: {
              filename: basename(opts.image),
              contentType: mimeType(opts.image),
            },
          },
          name: opts.name,
          symbol: opts.symbol,
          description: opts.description,
          twitter: opts.twitter,
          telegram: opts.telegram,
          website: opts.website,
        };
      } else {
        infoParams = {
          imageUrl: opts.imageUrl,
          name: opts.name,
          symbol: opts.symbol,
          description: opts.description,
          twitter: opts.twitter,
          telegram: opts.telegram,
          website: opts.website,
        };
      }

      spin('Step 1/3: Creating token info and metadata...');
      const tokenInfo =
        await sdk.tokenLaunch.createTokenInfoAndMetadata(infoParams);
      succeed(`Token mint: ${tokenInfo.tokenMint}`);

      const tokenMint = new PublicKey(tokenInfo.tokenMint);

      // Step 2: Create fee share config
      const claimers = JSON.parse(opts.claimers) as Array<{
        wallet: string;
        bps: number;
      }>;

      spin('Step 2/3: Creating fee share config...');
      const configResult = await sdk.config.createBagsFeeShareConfig(
        {
          feeClaimers: claimers.map((c) => ({
            user: new PublicKey(c.wallet),
            userBps: c.bps,
          })),
          payer: wallet,
          baseMint: tokenMint,
          partner: opts.partner ? new PublicKey(opts.partner) : undefined,
        },
        opts.tip
          ? {
              tipWallet: wallet,
              tipLamports: parseInt(opts.tip),
            }
          : undefined,
      );
      succeed(`Config key: ${configResult.meteoraConfigKey.toBase58()}`);

      // Sign and send config transactions (may be bundles)
      if (configResult.bundles.length > 0) {
        for (let i = 0; i < configResult.bundles.length; i++) {
          await signAndSendBundle(configResult.bundles[i], {
            dryRun: opts.dryRun,
          });
        }
      }
      for (const tx of configResult.transactions) {
        await signAndSend(tx, { dryRun: opts.dryRun, label: 'fee share config' });
      }

      // Step 3: Create launch transaction
      const initialBuyLamports = solToLamports(parseFloat(opts.initialBuy));

      spin('Step 3/3: Building launch transaction...');
      const launchTx = await sdk.tokenLaunch.createLaunchTransaction({
        metadataUrl: tokenInfo.tokenMetadata,
        tokenMint,
        launchWallet: wallet,
        initialBuyLamports,
        configKey: configResult.meteoraConfigKey,
        tipConfig: opts.tip
          ? { tipWallet: wallet, tipLamports: parseInt(opts.tip) }
          : undefined,
      });
      succeed();

      const sig = await signAndSend(launchTx, {
        dryRun: opts.dryRun,
        label: 'token launch',
      });

      if (isJson) {
        jsonOut({
          tokenMint: tokenInfo.tokenMint,
          metadataUrl: tokenInfo.tokenMetadata,
          configKey: configResult.meteoraConfigKey.toBase58(),
          launchSignature: sig,
        });
      } else if (!opts.dryRun) {
        console.log(t.title('\nToken Launched Successfully!\n'));
        console.log(
          kv([
            ['Token Mint', tokenInfo.tokenMint],
            ['Name', opts.name],
            ['Symbol', opts.symbol],
            ['Config Key', configResult.meteoraConfigKey.toBase58()],
            ['Launch Signature', sig],
          ]),
        );
      }
    }),
  );
