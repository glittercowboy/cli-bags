import { Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { getActiveProfile } from '../config/store.js';
import { ConfigError } from '../utils/error.js';

export function loadKeypair(): Keypair {
  const profile = getActiveProfile();
  if (!profile.privateKey) {
    throw new ConfigError(
      'Private key not set. Run `bags config set private-key <base58-key>`.',
    );
  }
  return Keypair.fromSecretKey(bs58.decode(profile.privateKey));
}

export function getWalletPublicKey(): PublicKey {
  return loadKeypair().publicKey;
}
