import { createClient } from "@supabase/supabase-js";

function cleanEnv(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

const supabaseUrl = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabasePublishableKey =
  cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ??
  cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

function isHttpUrl(value: string | undefined) {
  if (!value) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return Boolean(parsed.hostname && ["http:", "https:"].includes(parsed.protocol));
  } catch {
    return false;
  }
}

export const isSupabaseConfigured = Boolean(
  isHttpUrl(supabaseUrl) && supabasePublishableKey,
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        detectSessionInUrl: false,
        flowType: "pkce",
      },
    })
  : null;
