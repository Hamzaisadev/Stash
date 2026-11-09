import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Preload the two Latin font files the UI actually renders with.
 *
 * Text is the LCP element on this site, so without this the headline waits on
 * CSS parse before the font request even starts. Filenames are content-hashed
 * at build time, so they are discovered from the bundle rather than hardcoded.
 */
function preloadLatinFonts() {
  const WANTED = [
    'geist-latin-wght-normal',
    'geist-mono-latin-wght-normal',
  ];
  let tags = '';
  return {
    name: 'preload-latin-fonts',
    apply: 'build',
    generateBundle(_options, bundle) {
      const hits = Object.keys(bundle).filter((f) =>
        WANTED.some((w) => f.includes(w) && f.endsWith('.woff2')),
      );
      tags = hits
        .map(
          (f) =>
            `<link rel="preload" href="/${f}" as="font" type="font/woff2" crossorigin>`,
        )
        .join('\n    ');
    },
    transformIndexHtml: {
      order: 'post',
      handler: (html) =>
        tags ? html.replace('</head>', `  ${tags}\n  </head>`) : html,
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    preloadLatinFonts(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
