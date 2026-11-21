# Checkpoint: penguatan engine Warkai Previz disetujui

Tanggal: 21 November 2026, Asia/Jakarta.
Status terkini: penguatan engine lokal tersedia di commit `b749178`. Sebanyak 36 tes model/Director/visual, 4 tes API/render dan build produksi lulus. Empat MP4 dari UI diukur. Aragi berhasil membuat batch dari control-server lokal dan membaca kembali manifest serta snapshot. Batch kiriman pemanggil menunggu pengarahan Director. Bagian baseline dan urutan awal di bawah menyimpan konteks sebelum implementasi. Lihat bagian terakhir dan docs/QC.md untuk bukti terkini.

## Keputusan pengguna yang berlaku

Mas Ardi menyetujui penguatan mesin Warkai Previz awal. Pertahankan aplikasi, fungsi, tampilan dan alur studio yang sudah ada. Penambahan teknis yang diperlukan harus memperkuat fungsi tersebut dan tetap mudah dipakai pemula.

Cerita dan detail kreatif berasal dari Aragi atau pengguna dalam bentuk yang sudah jadi. Engine menerima hasilnya untuk diarahkan dan divisualkan. Pengembangan cerita, sistem brief/pemahaman cerita, wizard baru dan restruktur produk bukan lingkup implementasi.

Proposal Fondasi Terpadu R01 dan simulasi UI enam langkah yang sempat dibuat TIDAK DISETUJUI sebagai arah implementasi. Jangan membangunnya atau menjadikannya sumber utama. Audit engine 21 November tetap bahan teknis, tetapi hanya bagian yang sesuai lingkup di bawah yang berlaku. Contoh schema v3 sebelumnya adalah draft, bukan kontrak final.

Approval ini berlaku untuk implementasi bertahap dalam lingkup berikut. Tidak perlu meminta persetujuan ulang untuk pekerjaan implementasi rutin yang sudah tercakup. Kerjakan satu bagian hingga diuji sebelum lanjut.

## Sembilan penguatan yang disetujui

1. Penerimaan hasil cerita/shot dari Aragi atau pengguna: pemetaan identitas karakter, ID shot, durasi, rasio dan validasi kebutuhan teknis. Tandai ambiguitas atau konflik untuk pengarahan pada kontrol Director yang sudah ada. Jangan menulis ulang cerita/dialog/canon.
2. Kamera: multi-key path, IN/OUT yang bisa direvisi, signed orbit360, target pandang, lensa/fokus; line mengikuti gerak aktual.
3. Blocking Pill: beberapa titik rute, hold/turn/eyeline, cue duduk serta penempatan properti. Bantu pemeriksaan rute agar tidak menembus set. Pill dan Pill kepala bola tetap default, dengan nama unik dan kode stabil. Mannequin tidak dikembalikan. Cue HP/seat bukan klaim rig tangan/anatomi.
4. Kontinuitas Scene/Take/Shot/Edit secara internal: aksi dan posisi pemain tetap kontinu ketika kamera berganti. Migrasi copy-only mempertahankan proyek lama; jangan mengganti UI menjadi aplikasi baru.
5. QC komposisi: bantu menemukan occlusion, kepala bertumpuk/terpotong, foreground/reveal hilang; temuan merujuk shot dan frame. Hasil teknis dan review manusia berbeda.
6. Cahaya: perluas preset dengan sumber/key/fill/practical, posisi/arah dan kualitas bayangan sesuai kemampuan renderer. Diagram mengikuti data yang sama. Labeli batas soft-shadow/DoF dan estimasi, jangan klaim metering fisik yang belum dibuktikan.
7. Satu evaluasi gerak: stage, camera monitor, line, radar, telemetry, prompt dan ekspor memakai sampler yang sama, termasuk handheld/bob/jump/float/orbital. Pisahkan waktu aksi dari easing kamera.
8. Render/storage lokal: perbaiki admission race satu job, snapshot/revision/asset identity, status/cancel/recovery; output dan manifest berasal dari revisi yang sama.
9. Output: Clean Previz per klip untuk acuan vid-gen dan Director Breakdown yang menyatukan denah kamera/pemain, frame kamera, diagram cahaya dan telemetry. Pertahankan JSON/YAML, prompt, PNG/contact sheet serta manifest yang sudah ada.

## Batas integrasi Aragi

- Dua pintu masuk tetap: data cerita final dari Aragi atau impor mandiri melalui studio yang ada. Cabang Hasilkan Prompt di Aragi tidak harus melalui render Previz.
- Plan aragi.previz.plan.v1 yang diperiksa adalah plan teks/ID/rentang frame24fps; belum proyek3D siap render. Adapter diperlukan, jangan langsung kirim plan ke encoder PNG API.
- Jaga clipId, order, shot IDs, source/sequence frames, manual boundary dan kebutuhan produksi yang sudah diberikan. Jangan diam-diam reflow durasi, mengganti dialog atau menambah aksi.
- Pisahkan take aksi, shot/edit kamera, dan klip keluaran untuk provider. Klip keluaran dapat berisi beberapa shot atau bagian shot.
- Output per klip perlu MP4, durasi/frame/rasio terukur, snapshot dan asset manifest, pemetaan ID, status teknis dan QC visual. Antrean render lokal berbeda dari antrean generate per akun Aragi.
- Batas video keluaran dan total referensi provider berbeda. Unknown bukan unlimited. Profil/versi batas harus diperiksa saat integrasi; angka dari percakapan bukan verifikasi vendor otomatis.
- Status integrasi masih PARSIAL, belum batch otomatis/headless. Tidak mengubah Aragi atau memakai kredit generator tanpa lingkup/otorisasi yang sesuai.

## Baseline dan bukti

- Source awal implementasi: commit7961e5b58be264ed160e2efc3de921d39586d035, branch feat/shot-states-lighting, versi0.2.0.
- Main CP001 tetap checkpoint lama7fefde9. Jangan merge atau mengubah worktree/server yang dipakai tim tanpa memeriksa kondisi terkini.
- Audit21November:20tes model/Director +1tes integrasi render lulus; build berhasil; audit dependency0. Build memberi warning chunk Three.js/PDF. Ini baseline historis, bukan verifikasi perubahan yang belum dibuat.
- Race terbukti: dua POST render yang masuk sebelum body diselesaikan bisa menghasilkan200/200. Request biasa berurutan menghasilkan200/409. Busy check sekarang mendahului await body dan reservasi job; belum diperbaiki.
- Handheld/bob/jump/float/orbital masih ditambah di engine setelah model evaluation. Path/radar/prompt belum mencakup semuanya.
- Kamera/aktor masih dua endpoint; lighting Directional+Hemisphere+4Point; focus/aperture metadata; storage satu slot IndexedDB; render API encoder bergantung browser yang mengirim PNG.
- Probe insert menunjukkan teks aksi dapat tersalin tanpa blocking. Perubahan durasi RAW tidak otomatis ripple EDIT; kebijakan manual perlu dinyatakan agar tidak terjadi pergeseran diam-diam.
- Render film teknis sukses bukan creative approval. Konten SQ04/SQ09 revisi terakhir masih HOLD menurut QC Inara; jangan klaim seluruh film lolos.

## Urutan kerja yang dipakai saat implementasi

### Bagian pertama: andalkan render yang sudah ada

1. Baca AGENTS.md dan periksa git/worktree/runtime serta perubahan paralel.
2. Reproduksi admission race pada server sementara dengan dua body request tertunda; jangan mengganggu render pengguna.
3. Buat admission/reservation atomik, lepaskan reservasi pada payload invalid/error/cancel. Batas satu render harus berlaku juga pada request tumpang tindih.
4. Tambahkan regression test nyata untuk race, invalid request yang tidak menyangkut lock, serta cancellation. Pertahankan pembatas loopback/origin dan argumen FFmpeg tetap.
5. Jalankan tes relevan, npm test, npm run test:render dan build sesuai perubahan. Dokumentasikan bukti, checkpoint commit/push, lalu lanjut bagian berikutnya.

### Setelah bagian pertama lulus

- Pusatkan sampler gerak sebelum menambah multi-key; tetapkan scene/take/shot dan migrasi kompatibel.
- Tambah multi-key kamera/Pill dan kontinuitas, kemudian QC komposisi serta light rig sesuai kemampuan.
- Kunci snapshot/revision/asset manifest; multi-klip dan kontrak Aragi diuji dengan fixture anonim serta MP4 nyata.
- Terakhir Director Breakdown dan QC gabungan. Urutan dapat disesuaikan terhadap dependensi teknis, tanpa memperluas produk atau mengganti alur studio.

## Cara melanjutkan

Baca status terkini di awal dokumen dan bukti di docs/QC.md. Untuk melanjutkan review, buka Studio, pilih Export kemudian Hasil render lokal. Gunakan batch atau revisi sesuai kebutuhan Director. Proyek/media film, credentials, konfigurasi mesin dan isi cerita pengguna tidak masuk Git.

Skill: senior-fullstack untuk implementasi/audit; anti-slop mode during dipilih pengguna dalam chat ini, dengan panduan UI/human/mobile. Prinsip Easy Operation diterapkan pada kontrol studio yang diperkuat, bukan wizard cerita baru. Jangan menyimpan preferensi global skill tanpa permintaan.

### Pelaksanaan 21 November, antrean render

Probe pada baseline menerima dua job serentak. Setelah perubahan, dua body tertunda menghasilkan satu HTTP 200 dan satu HTTP 409. JSON rusak dan dimensi invalid melepas jalur masuk, DELETE menunggu encoder berhenti dan job berikutnya diterima. Verifikasi lokal: 20 tes model/Director, 2 tes HTTP render dan build lulus.

### Checkpoint implementasi engine, 21 November 2026

Studio menyediakan impor plan final, kamera dan Pill multi-key, cut lintas satu take, inspeksi komposisi per frame, lampu key/fill, serta Clean dan Director Breakdown per klip. Proyek, aset dan MP4 terikat hash revisi. Buka README untuk alur pengguna, docs/PROJECT_FORMAT.md untuk schema, docs/LOCAL_CLIP_EXPORT.md untuk kontrak Aragi dan docs/QC.md untuk bukti.

Render memerlukan tab WebGL untuk mengirim frame. Plan tekstual perlu pengarahan blocking dan kamera. Penilaian gambar serta hasil video generator tetap dilakukan Director. Uji dari aplikasi Aragi pada sisi pemanggil dapat dimulai dengan examples/aragi-manual.plan.json. Tidak ada perubahan aplikasi Aragi atau penggunaan kredit.
