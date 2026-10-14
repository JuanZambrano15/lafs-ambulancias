/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 5174, no 5173: para poder correr `app/` (la app Android/Capacitor,
  // en modo web de desarrollo) y este panel al mismo tiempo sin que
  // choquen los puertos.
  server: {
    port: 5174,
  },
  // issue #49: el panel se sirve bajo /admin/ detrás de Caddy (ver
  // infra/Caddyfile), así que los assets del build deben resolverse
  // con esa base, o el navegador los pediría desde la raíz del
  // dominio y Caddy los mandaría al reverse proxy de la API en vez de
  // al archivo estático.
  base: '/admin/',
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
})