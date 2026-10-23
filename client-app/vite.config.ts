import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import tsconfigPaths from 'vite-tsconfig-paths'
import { fileURLToPath, URL } from 'node:url'
import { execSync } from 'node:child_process'
// KS_CLIENT_v5_LICENSEE_APPS - VITE_LICENSEE=<key> builds licensees/<key>'s branded client; unset = default Keystone.
import { licenseePlugin, serverPlugin } from './vite.licensee'
// KS_CLIENT_v7_DEMO - the demo borrower page (/demo/<code>) talks to the demo server: allow it in the built CSP.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'
import { httpsOrigin, patchSwaConfig } from './src/demo/demoCsp'

function demoCspPlugin(): Plugin {
  let outDir = 'dist'
  return {
    name: 'ks-demo-csp',
    configResolved(cfg) { outDir = path.resolve(cfg.root, cfg.build.outDir) },
    writeBundle() {
      const origin = httpsOrigin(process.env.VITE_DEMO_SERVER_URL)
      const file = path.join(outDir, 'staticwebapp.config.json')
      if (!origin || !existsSync(file)) return
      writeFileSync(file, patchSwaConfig(readFileSync(file, 'utf8'), origin))
    },
  }
}

function buildSha(): string {
  const env = process.env.GITHUB_SHA;
  if (env) return env.slice(0, 7);
  try { return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
  catch { return ''; }
}

// BF_CLIENT_v789_NO_FORM_LOGS - production bundles carry no console.log/debug/info
// calls (they printed form answers and tokens into any shared devtools capture).
// console.warn and console.error stay so real failures are still reported.
export const PRODUCTION_DROPPED_CONSOLE = ['console.log', 'console.debug', 'console.info']

export default defineConfig(({ mode }) => {
  const licensee = licenseePlugin(mode, fileURLToPath(new URL('.', import.meta.url)))
  // KS_LICENSEE_DEPLOY_v1 - no licensee folder, but a server from the shell (a licensee's web deploy).
  const server = licensee ? null : serverPlugin()
  return {
  esbuild: mode === 'production' ? { pure: PRODUCTION_DROPPED_CONSOLE, drop: ['debugger'] } : {},
  // BF_CLIENT_APP_UPDATE_v723 - stamp each build so an installed phone app can tell it is out of date.
  define: {
    'import.meta.env.VITE_APP_BUILT_AT': JSON.stringify(new Date().toISOString()),
    // BF_CLIENT_PHONE_POLISH_v751 - short commit shown on More so a device's build can be confirmed.
    'import.meta.env.VITE_APP_BUILD_SHA': JSON.stringify(buildSha()),
  },
  plugins: [
    ...(licensee ? [licensee] : []),
    ...(server ? [server] : []),
    demoCspPlugin(),
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      manifestFilename: 'manifest.webmanifest',
      manifest: false,
      includeAssets: ['icons/**/*', 'favicon.ico', 'logo.svg'],
      workbox: {
        skipWaiting: false,
        clientsClaim: true
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webp,woff,woff2,json}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
      },
      devOptions: { enabled: false, type: 'module' }
    }),
    tsconfigPaths()
  ],

  build: {
    outDir: 'dist',

    // Reduce deploy payload file count + size.
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom']
        }
      }
    },

    chunkSizeWarningLimit: 1000,

    // Inline small assets to reduce file count.
    assetsInlineLimit: 4096
  },

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
  }
})
