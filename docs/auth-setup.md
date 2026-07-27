# Tockli Auth Setup

Tockli uses Supabase Auth for email/password login and Google SSO. The app code
redirects Google OAuth users through:

```text
https://tockli.netlify.app/auth/callback?next=/app
```

Supabase validates the path against its redirect allow-list, then exchanges the
OAuth code in `/auth/callback` with the Supabase PKCE flow and opens `/app`.

## Supabase Auth Settings

In Supabase for project `kebqumcvfncgrypoilcw`:

```text
Site URL:
https://tockli.netlify.app

Redirect URLs:
https://tockli.netlify.app/auth/callback
http://localhost:3000/auth/callback
```

Enable:

- Email/password provider
- Google provider

Apply the hosted database migrations, including:

```text
supabase/migrations/20260727183000_auth_user_profile_bootstrap.sql
```

That migration creates `public.profiles` and `public.user_settings` rows when a
new Supabase Auth user is created.

## Google Cloud OAuth Client

Create a Google OAuth Client ID with application type `Web application`.

Authorized JavaScript origins:

```text
https://tockli.netlify.app
http://localhost:3000
```

Authorized redirect URIs:

```text
https://kebqumcvfncgrypoilcw.supabase.co/auth/v1/callback
```

Copy the Google client ID and client secret into Supabase:

```text
Authentication > Providers > Google
```

Then save the provider settings and test `/signup` or `/login`.

## Expected Flow

1. User clicks Continue with Google.
2. Browser goes to Supabase `/auth/v1/authorize`.
3. Supabase sends the user to Google.
4. Google returns to Supabase `/auth/v1/callback`.
5. Supabase redirects to `https://tockli.netlify.app/auth/callback?next=/app`.
6. Tockli exchanges the code and opens `/app`.
