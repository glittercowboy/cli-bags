import { Connection, type Commitment } from '@solana/web3.js';
import { BagsSDK } from '@bagsfm/bags-sdk';
import { BagsApiClient } from '@bagsfm/bags-sdk/dist/api/bags-client.js';
import { getActiveProfile } from '../config/store.js';
import { ConfigError } from '../utils/error.js';

let _sdk: BagsSDK | null = null;

export function getSDK(): BagsSDK {
  if (_sdk) return _sdk;

  const profile = getActiveProfile();
  if (!profile.apiKey) {
    throw new ConfigError('API key not set. Run `bags config set api-key <key>`.');
  }
  if (!profile.rpcUrl) {
    throw new ConfigError('RPC URL not set. Run `bags config set rpc-url <url>`.');
  }

  const connection = new Connection(profile.rpcUrl, profile.commitment as Commitment);
  _sdk = new BagsSDK(profile.apiKey, connection, profile.commitment as Commitment);
  return _sdk;
}

export function getConnection(): Connection {
  const profile = getActiveProfile();
  if (!profile.rpcUrl) {
    throw new ConfigError('RPC URL not set. Run `bags config set rpc-url <url>`.');
  }
  return new Connection(profile.rpcUrl, profile.commitment as Commitment);
}

export function getRawClient(): BagsApiClient {
  const profile = getActiveProfile();
  if (!profile.apiKey) {
    throw new ConfigError('API key not set. Run `bags config set api-key <key>`.');
  }
  return new BagsApiClient(profile.apiKey);
}

export function resetSDK(): void {
  _sdk = null;
}
