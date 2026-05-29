import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            strategies: 'injectManifest',
            srcDir: 'src/sw',
            filename: 'service-worker.ts',
            outDir: 'dist',
            injectManifest: {
                rollupFormat: 'iife',
            },
            injectRegister: false,
            manifest: false,
            scope: '/',
            devOptions: {
                enabled: false,
            },
        }),
    ],
});
//# sourceMappingURL=vite.config.js.map