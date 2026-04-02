import { Command } from 'commander';
import { getSDK } from '../sdk/client.js';
import { t } from '../output/theme.js';
import { kv, jsonOut } from '../output/format.js';
import { spin, succeed } from '../output/spinner.js';
import { withErrorHandler } from '../utils/error.js';
import { resolveMint, lamportsToSol } from '../utils/solana.js';
import { signAndSend } from '../crypto/signer.js';
import { getWalletPublicKey } from '../crypto/keypair.js';

export const tradeCommand = new Command('trade').description(
  'Trading and swap operations',
);

tradeCommand
  .command('quote')
  .description('Get a swap quote')
  .requiredOption('--in <mint>', 'Input token mint or SOL')
  .requiredOption('--out <mint>', 'Output token mint or SOL')
  .requiredOption('--amount <n>', 'Amount in smallest unit (lamports for SOL)')
  .option('--slippage <bps>', 'Slippage in basis points')
  .action(
    withErrorHandler(async (opts, cmd) => {
      const isJson = cmd.optsWithGlobals().json;
      const sdk = getSDK();

      const inputMint = resolveMint(opts.in);
      const outputMint = resolveMint(opts.out);
      const amount = parseInt(opts.amount);

      spin('Fetching quote...');
      const quote = await sdk.trade.getQuote({
        inputMint,
        outputMint,
        amount,
        ...(opts.slippage
          ? { slippageMode: 'manual' as const, slippageBps: parseInt(opts.slippage) }
          : { slippageMode: 'auto' as const }),
      });
      succeed();

      if (isJson) {
        jsonOut(quote);
        return;
      }

      console.log(
        kv([
          ['Input', `${quote.inAmount} (${quote.inputMint})`],
          ['Output', `${quote.outAmount} (${quote.outputMint})`],
          ['Min Output', quote.minOutAmount],
          ['Price Impact', `${quote.priceImpactPct}%`],
          ['Slippage', `${quote.slippageBps} bps`],
          ['Route Steps', String(quote.routePlan.length)],
          [
            'Platform Fee',
            quote.platformFee
              ? `${quote.platformFee.amount} (${quote.platformFee.feeBps} bps)`
              : 'none',
          ],
        ]),
      );
    }),
  );

tradeCommand
  .command('swap')
  .description('Execute a token swap')
  .requiredOption('--in <mint>', 'Input token mint or SOL')
  .requiredOption('--out <mint>', 'Output token mint or SOL')
  .requiredOption('--amount <n>', 'Amount in smallest unit (lamports for SOL)')
  .option('--slippage <bps>', 'Slippage in basis points')
  .option('--dry-run', 'Build and sign tx without submitting')
  .action(
    withErrorHandler(async (opts, cmd) => {
      const isJson = cmd.optsWithGlobals().json;
      const sdk = getSDK();
      const userPublicKey = getWalletPublicKey();

      const inputMint = resolveMint(opts.in);
      const outputMint = resolveMint(opts.out);
      const amount = parseInt(opts.amount);

      spin('Fetching quote...');
      const quote = await sdk.trade.getQuote({
        inputMint,
        outputMint,
        amount,
        ...(opts.slippage
          ? { slippageMode: 'manual' as const, slippageBps: parseInt(opts.slippage) }
          : { slippageMode: 'auto' as const }),
      });
      succeed();

      console.log(
        kv([
          ['Input', `${quote.inAmount} (${quote.inputMint})`],
          ['Output', `${quote.outAmount} (${quote.outputMint})`],
          ['Price Impact', `${quote.priceImpactPct}%`],
        ]),
      );

      spin('Building swap transaction...');
      const { transaction } = await sdk.trade.createSwapTransaction({
        quoteResponse: quote,
        userPublicKey,
      });
      succeed();

      const sig = await signAndSend(transaction, {
        dryRun: opts.dryRun,
        label: 'swap',
      });

      if (isJson && !opts.dryRun) {
        jsonOut({ signature: sig, quote });
      }
    }),
  );
