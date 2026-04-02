import { PublicKey } from '@solana/web3.js';
import { WRAPPED_SOL_MINT } from '@bagsfm/bags-sdk';

const LAMPORTS_PER_SOL = 1_000_000_000;

export function resolveMint(input: string): PublicKey {
  if (input.toUpperCase() === 'SOL') {
    return WRAPPED_SOL_MINT;
  }
  return new PublicKey(input);
}

export function lamportsToSol(lamports: number | string): number {
  return Number(lamports) / LAMPORTS_PER_SOL;
}

export function solToLamports(sol: number | string): number {
  return Math.round(Number(sol) * LAMPORTS_PER_SOL);
}

export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function isValidPublicKey(input: string): boolean {
  try {
    new PublicKey(input);
    return true;
  } catch {
    return false;
  }
}
