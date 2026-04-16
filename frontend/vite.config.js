import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'pwa-192x192.svg', 'pwa-512x512.svg'],
            manifest: {
                name: 'PayrollPro Mobile',
                short_name: 'PayrollPro',
                description: 'HR & Payroll Management App for Mobile',
                theme_color: '#ffffff',
                background_color: '#ffffff',
                display: 'standalone',
                icons: [
                    {
                        src: '/pwa-192x192.svg',
                        sizes: '192x192',
                        type: 'image/svg+xml'
                    },
                    {
                        src: '/pwa-512x512.svg',
                        sizes: '512x512',
                        type: 'image/svg+xml'
                    },
                    {
                        src: '/pwa-512x512.svg',
                        sizes: '512x512',
                        type: 'image/svg+xml',
                        purpose: 'any maskable'
                    }
                ]
            }
        })
    ],
    server: {
        port: 3000,
        proxy: {
            '/api': { target: 'http://localhost:3001', changeOrigin: true },
            '/pdfs': { target: 'http://localhost:3001', changeOrigin: true },
        }
    }
});
