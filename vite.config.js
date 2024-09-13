import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import EnvironmentPlugin from 'vite-plugin-environment';
// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [
    react(),
    EnvironmentPlugin({
      NODE_ENV: process.env.NODE_ENV || 'development',
    }),
  ],
  resolve: {
    alias: {
      path: 'path-browserify',
      '@assets': '/src/assets',
      '@css': '/src/assets/css',
    },
  },
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
