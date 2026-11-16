# CP001 — local previz studio

Scope: aplikasi lokal Three.js untuk pill/graybox, kamera, blocking, multishot, blueprint dan handoff prompt video AI. Implementasi bersifat umum; tidak dikunci ke satu film.

## Dapat dilanjutkan dari sini

- `npm ci`, lalu `npm run dev`; buka http://127.0.0.1:4317.
- FFmpeg dengan libx264 diperlukan untuk render MP4 frame-akurat; atur `WARKAI_FFMPEG` atau `.local/ffmpeg-path` bila belum ada di PATH.
- `start.command` adalah launcher Mac. `.local/node-path` mendukung runtime Node nonstandar pada mesin yang sudah disiapkan.
- `npm test`, `npm run build`, `npm audit`; lihat `docs/QC.md` untuk bukti dan batas verifikasi.
- `npm run validate -- examples/subsecond-30fps.json` untuk memvalidasi proyek; tambahkan `--manifest` untuk mencetak pemetaan waktu.
- Schema stabil: `warkai-previz/1`; panduan `docs/PROJECT_FORMAT.md`; contoh lengkap dalam `examples/`.

## Status

Implementasi inti, instalasi lokal, render video nyata, validasi proyek dan browser QC selesai. Demo umum dipulihkan setelah pengujian. Server lokal tetap dipakai pengguna. Checkpoint source berada di repositori GitHub yang diminta pengguna.

Bejo bertanggung jawab atas aplikasi dan QA teknis. Neng Inara bertanggung jawab atas brief dan QC konten film melalui chat terpisah. Data/media film tidak masuk checkpoint publik ini. Kebutuhan konten baru dibawa melalui proyek JSON/YAML, bukan hardcode aplikasi.

## Batas versi ini

- Video mengekspor RAW seluruh shot menurut urutan proyek. Manifest memetakan trim EDIT dan job; conform EDIT belum otomatis.
- Cue pose dan gerak sederhana; head-yaw independen, rig realistis, kontak otomatis, audio mixing dan blur DoF belum tersedia.
- Prompt assistant offline berbasis kata kunci, bukan model AI atau API generator.
- Belum menjadi layanan SaaS multiuser/hosted dengan login, billing atau storage cloud.

Jika melanjutkan: periksa keadaan repo dan runtime terkini, jangan menganggap screenshot atau checkpoint ini membuktikan instalasi di komputer lain. Pertahankan proyek pengguna dan test boundary frame sebelum mengubah timing.
