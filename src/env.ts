import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    AXIOM_TOKEN: z.string().min(1).optional(),
    GROQ_API_KEY: z.string().min(1),
    RESEND_API_KEY: z.string().min(1),
    TRIGGER_API_KEY: z.string().min(1),
    TRIGGER_API_URL: z.string().url().optional(),
    TRIGGER_PROJECT_REF: z.string().optional(),
    TRIGGER_SECRET_KEY: z.string().min(1),
  },
  client: {
    NEXT_PUBLIC_AXIOM_DATASET: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1),
  },
  runtimeEnv: {
    AXIOM_TOKEN: process.env.AXIOM_TOKEN,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    NEXT_PUBLIC_AXIOM_DATASET: process.env.NEXT_PUBLIC_AXIOM_DATASET,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    TRIGGER_API_KEY: process.env.TRIGGER_API_KEY,
    TRIGGER_API_URL: process.env.TRIGGER_API_URL,
    TRIGGER_PROJECT_REF: process.env.TRIGGER_PROJECT_REF,
    TRIGGER_SECRET_KEY: process.env.TRIGGER_SECRET_KEY,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
