import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const API = env.VITE_API_BASE_URL || 'http://localhost:8000'

  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': { target: API, changeOrigin: true },
        '/broadcasting': { target: API, changeOrigin: true },
        '/storage': { target: API, changeOrigin: true }
      }
    },
    resolve: { alias: { '@': '/src' } }
  }
})
