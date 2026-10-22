import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
export default defineConfig(function (_a) {
    var mode = _a.mode;
    var env = loadEnv(mode, process.cwd(), '');
    var API = env.VITE_API_BASE_URL || 'http://localhost:8000';
    return {
        plugins: [react()],
        css: {
            postcss: {
                plugins: [
                    tailwindcss,
                    autoprefixer,
                ],
            },
        },
        server: {
            port: 5173,
            host: true,
            proxy: {
                '/api': { target: API, changeOrigin: true },
                '/broadcasting': { target: API, changeOrigin: true },
                '/storage': { target: API, changeOrigin: true }
            }
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src')
            }
        },
        // En production, les traces de débogage (données utilisateur, réponses API) ne
        // doivent pas finir dans la console des navigateurs ; console.error/warn restent.
        esbuild: mode === 'production'
            ? { pure: ['console.log', 'console.debug', 'console.info'], drop: ['debugger'] }
            : undefined,
    };
});
