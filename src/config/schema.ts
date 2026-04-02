import { z } from 'zod';

const ProfileSchema = z.object({
  apiKey: z.string().optional(),
  rpcUrl: z.string().url().optional(),
  privateKey: z.string().optional(),
  commitment: z
    .enum(['processed', 'confirmed', 'finalized'])
    .default('confirmed'),
});

export const ConfigSchema = z.object({
  activeProfile: z.string().default('default'),
  profiles: z.record(z.string(), ProfileSchema).default({
    default: { commitment: 'confirmed' },
  }),
  auth: z
    .object({
      jwt: z.string().optional(),
      expiresAt: z.number().optional(),
    })
    .optional(),
});

export type Profile = z.infer<typeof ProfileSchema>;
export type Config = z.infer<typeof ConfigSchema>;
