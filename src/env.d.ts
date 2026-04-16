/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    user: import('@supabase/supabase-js').User | null;
  }
}

interface ImportMetaEnv {
  readonly HELLOASSO_CLIENT_ID: string;
  readonly HELLOASSO_CLIENT_SECRET: string;
  readonly HELLOASSO_REFRESH_TOKEN: string;
  readonly HELLOASSO_DON_MANUEL: string;
  readonly FRAMASPACE_URL: string;
  readonly FRAMASPACE_USER: string;
  readonly FRAMASPACE_PASSWORD: string;
  readonly CRON_SECRET: string;
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  readonly SUPABASE_SERVICE_ROLE_KEY: string;
  readonly RESEND_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
