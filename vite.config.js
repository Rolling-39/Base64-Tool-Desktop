import { defineConfig } from 'vite';

export default defineConfig({
    root: 'src',
    build: { outDir: '../dist' },
    server: { port: 1420, strictPort: true },
    clearScreen: false,
});
