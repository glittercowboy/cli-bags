import { getActiveProfile, loadConfig } from '../config/store.js';
import { ConfigError } from '../utils/error.js';

const BASE_URL = 'https://public-api-v2.bags.fm/api/v1';

async function request<T>(
  method: string,
  path: string,
  opts?: { body?: unknown; useJwt?: boolean },
): Promise<T> {
  const profile = getActiveProfile();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (opts?.useJwt) {
    const config = loadConfig();
    if (!config.auth?.jwt) {
      throw new ConfigError(
        'Not authenticated. Run `bags auth init` first.',
      );
    }
    headers['Authorization'] = `Bearer ${config.auth.jwt}`;
  } else if (profile.apiKey) {
    headers['x-api-key'] = profile.apiKey;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });

  const data = await res.json();

  if (!res.ok || data.success === false) {
    const msg = data.error ?? data.message ?? `HTTP ${res.status}`;
    const err = new Error(msg) as Error & {
      url: string;
      status: number;
    };
    err.url = path;
    err.status = res.status;
    throw err;
  }

  return data.response ?? data;
}

// Auth
export interface AuthInitResponse {
  publicIdentifier: string;
  secret: string;
  agentUsername: string;
  agentUserId: string;
  verificationPostContent: string;
}

export async function authInit(
  username: string,
): Promise<AuthInitResponse> {
  return request('POST', '/agent/auth/init', {
    body: { agentUsername: username },
  });
}

export interface AuthLoginResponse {
  token: string;
}

export async function authLogin(
  publicIdentifier: string,
  secret: string,
  postId: string,
): Promise<AuthLoginResponse> {
  return request('POST', '/agent/auth/login', {
    body: { publicIdentifier, secret, postId },
  });
}

// API Keys
export interface AgentApiKey {
  keyId: string;
  key?: string;
  name: string;
  status: string;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export async function listApiKeys(): Promise<AgentApiKey[]> {
  return request('POST', '/agent/dev/keys', { useJwt: true });
}

export async function createApiKey(
  name: string,
): Promise<AgentApiKey> {
  return request('POST', '/agent/dev/keys/create', {
    body: { name },
    useJwt: true,
  });
}

// Wallets
export async function listWallets(): Promise<string[]> {
  return request('POST', '/agent/wallet/list', { useJwt: true });
}

export async function exportWallet(
  wallet: string,
): Promise<{ privateKey: string }> {
  return request('POST', '/agent/wallet/export', {
    body: { wallet },
    useJwt: true,
  });
}
