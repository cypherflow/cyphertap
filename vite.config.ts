import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'

import { watchAndRun } from 'vite-plugin-watch-and-run';
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  build: {
    lib: {
      name: "Cyphertap",
      entry: "src/index.ts",
      formats: ['es', 'umd'],
      fileName: (format, entryName) => `${entryName}.${format}.js`
    },
    cssCodeSplit: true,
  },
  plugins: [
    cssInjectedByJsPlugin(),
    svelte({
      emitCss: false,
    }),

    watchAndRun([
      {
        name: "gen",
        watchKind: ["add", "change", "unlink"],
        watch: resolve("src/**/*.svelte"),
        run: "pnpm run build",
        delay: 300
      }
    ])
  ],
})
