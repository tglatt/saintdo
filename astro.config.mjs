import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  site: 'https://saintdo.org',
  output: 'server',
  adapter: node({ mode: 'standalone' }),
});
