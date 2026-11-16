# Warkai Previz Visual

Aplikasi lokal, konten-netral untuk menyusun previz dan prompt video AI. Bejo menangani implementasi aplikasi dan QA teknis. Brief/canon dan persetujuan kreatif berada pada pemilik konten.

- `src/model.js` adalah sumber bersama schema, evaluasi waktu, blocking dan prompt. Jangan membuat logika waktu paralel di UI atau renderer.
- Jaga batas cut pada frame, terutama penjumlahan desimal. Jalankan `npm test` dan `npm run build` setelah perubahan model/render.
- `scripts/render-api.mjs` adalah API lokal Vite. Proses FFmpeg memakai argumen tetap, input dibatasi, frame berurutan dan origin lokal. Output sementara berada di `.local/`.
- `src/engine.js` merender stage, monitor dan output bersih. Helper stage tidak ikut frame/video.
- Proyek/media/GLB pengguna, credentials dan konfigurasi mesin tidak masuk Git. JSON/YAML contoh dalam `examples/` adalah demo umum.
- Jangan menambah layanan berbayar, upload otomatis atau ketergantungan jaringan untuk fungsi lokal tanpa permintaan pengguna.
- `docs/QC.md` membedakan uji nyata dari kemampuan yang belum diverifikasi; pertahankan kejelasan itu saat mengubah fitur.
