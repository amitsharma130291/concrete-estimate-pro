// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

import sitemap from '@astrojs/sitemap';

// TODO: update once the real domain is registered — this drives every canonical URL
// and the sitemap, so it must match the live domain exactly (protocol + host, no path).
const SITE_URL = 'https://concreteestimatepro.com';

// https://astro.build/config
export default defineConfig({
  site: SITE_URL,
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
