import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://saintdo.org',
  output: 'server',
  adapter: vercel(),
});
