# QC — local release 0.1.0

Diuji pada sesi 15–16 November 2026 pada Mac lokal, Node 22.23.4 dan browser dalam Codex. Hasil di bawah adalah pemeriksaan nyata; belum membuktikan kompatibilitas seluruh browser/perangkat.

## Hasil

| Area | Hasil |
|---|---|
| Instalasi | `npm install` / dependency lock berhasil; server loopback 127.0.0.1:4317 merespons HTTP 200 |
| Unit | 8 tes lulus: validasi, interpolasi kamera/orbit, carry-over blocking, prompt, metadata waktu, postur dan batas cut desimal |
| Render regression | 1 tes integrasi HTTP lulus: cancel menutup pipe FFmpeg idle, origin ditolak dan file job yang dibatalkan tidak tersedia |
| Pembatalan UI | Tombol batal menampilkan toast dan menutup overlay; renderer kembali idle |
| Build | `npm run build` berhasil; warning ukuran vendor Three.js ~688 kB, bukan error |
| Dependencies | `npm audit`: 0 vulnerability setelah pembaruan YAML 2.9.1 |
| Studio UI | Monitor kamera, diorama, radar, kurva telemetry dan pemilihan shot berjalan |
| Edit UI | Nama objek commit saat meninggalkan field; tambah/duplikat/hapus objek; undo/redo; tambah/hapus shot diuji |
| Prompt Lab | Teks “Orbit close-up 50mm selama 8 detik” menghasilkan durasi 8 s, orbit dan 50→50mm di prompt aktual |
| JSON/YAML | Keduanya diekspor lewat UI, diimpor kembali, valid dan semantik identik |
| Input salah | Proyek berdurasi negatif ditolak; proyek sebelumnya tetap aktif |
| GLB | Fixture GLB mandiri diimpor, tampak pada stage, embedded dalam JSON; roundtrip dan restore sesudah reload berhasil |
| Video referensi | MP4 lokal 15 s terbaca; playback referensi mengikuti waktu studio; tidak diunggah ke layanan luar |
| Autosave | IndexedDB memulihkan 8 objek termasuk GLB setelah reload |
| Desktop | Screenshot penuh workspace diperiksa pada viewport default 1280 px |
| Mobile | Layout diuji 390×844; scrollWidth 385 px, tanpa overflow horizontal; viewport dipulihkan |
| API render | Cross-origin ditolak 403; dimensi ganjil ditolak 400; job tidak ada menghasilkan 404 |
| Launcher | `zsh -n start.command` lulus; server Node lokal nyata sudah berjalan. Klik ganda melalui Finder belum diuji |

## Bukti video nyata dari UI

| Proyek uji | Format | Dimensi | FPS | Frame | Durasi |
|---|---|---|---|---|---|
| Quiet signal / empat shot | H.264 MP4 / yuv420p | 1280×720 | 24/1 | 504 | 21.000000 s |
| Subdetik / 0,8 + 0,9 + 1,3 s | H.264 MP4 / yuv420p | 1280×720 | 30/1 | 90 | 3.000000 s |
| Stress test konten / 12 objek, enam shot | H.264 MP4 / yuv420p | 1280×720 | 30/1 | 390 | 13.000000 s |

Angka diverifikasi dengan `ffprobe -count_frames`. Frame start/end dan contact sheet diperiksa visual. Proyek konten tetap dimiliki tim konten dan tidak disertakan dalam repositori aplikasi.

### Temuan yang diperbaiki

- Tinggi intrinsik inspector sempat meregangkan area stage; grid dan scroll pane dibatasi.
- Pemakaian shadow-map lama diperbarui ke PCFShadowMap sesuai Three.js 0.187.
- Commit text field diperkuat dengan focusout agar edit di browser ini tersimpan.
- Penjumlahan 0,8 + 0,9 sempat menunda cut kedua satu frame. Selector timeline sekarang memakai toleransi 1e−8 dan clamp waktu lokal; regression test memeriksa frame 23/24 serta 50/51. Render ulang membuktikan cut pada frame 24 dan 51. File uji pertama sebelum perbaikan dianggap superseded.
- Pembatalan FFmpeg sempat menunggu input pipe tanpa selesai; sekarang pipe ditutup dahulu dan penghentian SIGKILL menjadi fallback setelah satu detik. Uji UI dan regresi HTTP lulus. Status busy/progress mencegah konflik render antar tab.
- Ekspor menunggu model GLB selesai dimuat dan menolak render bila asset gagal dimuat.

## Batas bukti

- Belum menguji Safari/Chrome mandiri, Windows atau Linux secara langsung.
- Fallback MediaRecorder belum diuji sebagai jalur utama; timing frame-akurat hanya diklaim untuk render PNG → FFmpeg.
- Uji render memakai 16:9. Pilihan rasio lain tersedia dengan matematik dimensi rasio asli, tetapi belum semuanya memiliki video QC tersendiri.
- Audio, DoF blur, rig realistis, auto-contact kursi/lantai, head-yaw terpisah, multiuser dan video-generator API belum diimplementasikan.
- QC framing atau prop pada proyek film adalah pekerjaan pemilik konten; keberhasilan ekspor tidak sama dengan persetujuan kreatif sebuah shot.
