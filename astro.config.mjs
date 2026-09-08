// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';

import sitemap from '@astrojs/sitemap';

const SITE_URL = 'https://concretecostpro.com';

// https://astro.build/config
export default defineConfig({
  site: SITE_URL,
  // Every page still prerenders to static HTML by default (unchanged); only
  // src/pages/api/contact.ts opts into on-demand rendering via `export const prerender = false`,
  // so it runs as a Vercel serverless function instead of being baked in at build time.
  adapter: vercel(),
  integrations: [
    react(),
    sitemap({
      // /app/* is the local-first Pro application, not indexable content — keep it out of the sitemap.
      filter: (page) => !page.includes('/app/'),
    }),
  ],

  vite: {
    plugins: [tailwindcss()],
  },
});
