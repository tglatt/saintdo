/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly HELLOASSO_CLIENT_ID: string;
  readonly HELLOASSO_CLIENT_SECRET: string;
  readonly HELLOASSO_REFRESH_TOKEN: string;
  readonly HELLOASSO_DON_MANUEL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
