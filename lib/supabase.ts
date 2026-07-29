import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

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
