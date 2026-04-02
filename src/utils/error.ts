import { t } from '../output/theme.js';
import { fail } from '../output/spinner.js';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export function handleError(error: unknown): never {
  fail();

  if (error instanceof ConfigError) {
    console.error(t.error(`Config error: ${error.message}`));
    console.error(t.dim('Run `bags config init` to set up your configuration.'));
    process.exit(1);
  }

  // SDK ApiError (has url, status, data fields)
  if (
    error instanceof Error &&
    'url' in error &&
    'status' in error
  ) {
    const e = error as Error & { url: string; status?: number; data?: any };
    const status = e.status ?? 'unknown';
    console.error(t.error(`API error (${status}): ${e.message}`));

    if (e.status === 401) {
      console.error(
        t.dim('Invalid or missing API key. Run `bags config set api-key <key>`.'),
      );
    } else if (e.status === 429) {
      console.error(
        t.dim('Rate limited (1000 req/hr). Wait and retry.'),
      );
    }
    process.exit(1);
  }

  if (error instanceof Error) {
    console.error(t.error(error.message));
    if (process.env.BAGS_DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }

  console.error(t.error(String(error)));
  process.exit(1);
}

export function withErrorHandler<T extends (...args: any[]) => Promise<any>>(
  fn: T,
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error);
    }
  }) as T;
}
