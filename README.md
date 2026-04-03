# bags

CLI for the [Bags.fm](https://bags.fm) API. Launch tokens, swap, claim fees, manage wallets — all from your terminal.

## Install

```bash
git clone https://github.com/glittercowboy/cli-bags.git
cd cli-bags
npm install
npm run build
npm link
```

This installs `bags` as a global command.

## Setup

```bash
bags config init
```

You'll be prompted for:
- **API key** — get one at [dev.bags.fm](https://dev.bags.fm)
- **RPC URL** — Solana RPC endpoint (default: `https://api.mainnet-beta.solana.com`)
- **Commitment** — `confirmed` (recommended), `finalized`, or `processed`
- **Private key** — base58 Solana keypair (needed for signing transactions)

Config is stored at `~/.bags/config.json` with `0600` permissions.

## Commands

### Token Operations

```bash
bags token leaderboard                    # Top tokens by lifetime fees
bags token feed                           # Browse recent launches
bags token fees --mint <addr>             # Lifetime fees for a token
bags token creators --mint <addr>         # List creators and fee claimers
bags token info --name "X" --symbol "X" --description "X" --image ./logo.png
bags token launch --name "X" --symbol "X" --description "X" --image ./logo.png \
  --claimers '[{"wallet":"...","bps":10000}]' --initial-buy 0.1
```

### Trading

```bash
bags trade quote --in SOL --out <mint> --amount 100000000    # Get quote (0.1 SOL)
bags trade swap --in SOL --out <mint> --amount 100000000     # Execute swap
bags trade swap --in <mint> --out SOL --amount <n>           # Sell tokens
```

Use `SOL` as shorthand for wrapped SOL. Amounts are in lamports (1 SOL = 1,000,000,000).

### Fee Claiming

```bash
bags claim positions                      # List claimable fees
bags claim execute                        # Claim all fees
bags claim stats --mint <addr>            # Per-creator claim stats
bags claim events --mint <addr>           # Claim history
```

### Fee Share Management

```bash
bags fee-share list                       # Tokens where you're admin
bags fee-share lookup --username X --provider twitter
bags fee-share create --mint <addr> --claimers '[{"wallet":"...","bps":5000}]'
bags fee-share update --mint <addr> --claimers '<json>'
bags fee-share transfer --mint <addr> --new-admin <addr>
```

### Partner Program

```bash
bags partner create                       # Create partner config
bags partner stats                        # Claimed/unclaimed fees
bags partner claim                        # Claim partner fees
```

### Pool Data

```bash
bags pool leaderboard                     # Top tokens by fees
bags pool list [--migrated]               # All pools
bags pool info --mint <addr>              # Pool details for a token
```

### Dexscreener

```bash
bags dex check --mint <addr>              # Check order availability
bags dex order --mint <addr> --description "X" --icon-url <url> --header-url <url>
bags dex pay --order-uuid <uuid> --signature <sig>
```

### Incorporation

```bash
bags incorporate start-payment            # Initiate payment
bags incorporate submit --details '<json>'
bags incorporate start --token <addr>
bags incorporate details --token <addr>
bags incorporate list
```

### Transactions

```bash
bags tx send --tx <base58>                # Send signed transaction
bags tx bundle --txs <base58,...>          # Send Jito bundle
bags tx bundle-status --ids <id,...>       # Check bundle status
bags tx jito-fees                         # Current tip fee levels
```

### Auth & Keys

Requires Moltbook account:

```bash
bags auth init --username <moltbook>
bags auth login --identifier <id> --secret <s> --post-id <id>
bags keys list
bags keys create --name <name>
bags wallet list
bags wallet export --address <addr>
```

### Config

```bash
bags config init                          # Interactive setup
bags config show                          # Show current config
bags config set api-key <key>             # Set API key
bags config set rpc-url <url>             # Set RPC URL
bags config set private-key <base58>      # Set signing key
bags config set commitment confirmed      # Set commitment level
bags ping                                 # Health check
```

## Global Flags

```
--json          Output raw JSON (all commands)
--profile <n>   Use a named config profile
--dry-run       Sign but don't submit (transaction commands)
```

## Multi-Profile Support

```bash
bags config set active-profile trading
bags --profile trading trade swap ...
```

## Quick Reference

| Amount | Lamports |
|--------|----------|
| 0.001 SOL | 1,000,000 |
| 0.01 SOL | 10,000,000 |
| 0.1 SOL | 100,000,000 |
| 1 SOL | 1,000,000,000 |

## Rate Limits

1,000 requests per hour per account (across all API keys).

## License

MIT
