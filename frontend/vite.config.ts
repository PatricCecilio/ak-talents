import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Google sign-in (redirect mode) returns to /auth/google/retorno/<door> on the SITE's own origin (so its g_csrf_token
// cookie comes along). In production vercel.json forwards it to the API; locally this proxy does the same.
const localApi = process.env.AK_LOCAL_API || 'http://localhost:8000'
const googleReturnProxy = {
  '/auth/google/retorno': {
    target: localApi,
    changeOrigin: true,
    rewrite: (path: string) => path.replace('/auth/google/retorno', '/auth/google/redirect'),
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5174,
    proxy: googleReturnProxy,
  },
  preview: {
    proxy: googleReturnProxy,
  },
})
