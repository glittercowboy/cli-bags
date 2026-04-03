import { Command } from 'commander';
import { setProfileOverride } from './config/store.js';
import { configCommand } from './commands/config-cmd.js';
import { pingCommand } from './commands/ping.js';
import { tokenCommand } from './commands/token.js';
import { poolCommand } from './commands/pool.js';
import { claimCommand } from './commands/claim.js';
import { partnerCommand } from './commands/partner.js';
import { feeShareCommand } from './commands/fee-share.js';
import { tradeCommand } from './commands/trade.js';
import { txCommand } from './commands/tx.js';
import { dexCommand } from './commands/dex.js';
import { authCommand } from './commands/auth.js';
import { keysCommand } from './commands/keys.js';
import { walletCommand } from './commands/wallet.js';
import { incorporateCommand } from './commands/incorporate.js';

export function createProgram(): Command {
  const program = new Command('bags')
    .description('CLI for the Bags.fm API')
    .version('0.1.0')
    .option('--profile <name>', 'Config profile to use', 'default')
    .option('--json', 'Output raw JSON')
    .option('--verbose', 'Debug output')
    .hook('preAction', (thisCommand) => {
      const opts = thisCommand.opts();
      if (opts.profile && opts.profile !== 'default') {
        setProfileOverride(opts.profile);
      }
    });

  program.addCommand(configCommand);
  program.addCommand(pingCommand);
  program.addCommand(tokenCommand);
  program.addCommand(poolCommand);
  program.addCommand(claimCommand);
  program.addCommand(partnerCommand);
  program.addCommand(feeShareCommand);
  program.addCommand(tradeCommand);
  program.addCommand(txCommand);
  program.addCommand(dexCommand);
  program.addCommand(authCommand);
  program.addCommand(keysCommand);
  program.addCommand(walletCommand);
  program.addCommand(incorporateCommand);

  return program;
}
