import { createServer } from 'vite';
const server = await createServer({ server: { host: '127.0.0.1', port: Number(process.env.WARKAI_PORT || 4317), strictPort: true } });
await server.listen(); server.printUrls();
console.log('Warkai Previz Visual siap. Tekan Control+C untuk menghentikan server.');
for (const s of ['SIGTERM', 'SIGINT']) process.on(s, async () => { await server.close(); process.exit(0); });
