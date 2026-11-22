import { defineConfig } from 'vite';
import { renderAPI } from './scripts/render-api.mjs';
export default defineConfig({ plugins: [renderAPI()], server: { host: '127.0.0.1', port: Number(process.env.WARKAI_PORT || 4317), strictPort: true }, preview: { host: '127.0.0.1', port: Number(process.env.WARKAI_PORT || 4317), strictPort: true }, build: { rolldownOptions: { output: { codeSplitting: { groups: [{ name: 'three', test: /node_modules\/three/ }, { name: 'icons', test: /node_modules\/lucide/ }, { name: 'yaml', test: /node_modules\/yaml/ }] } } } } });
