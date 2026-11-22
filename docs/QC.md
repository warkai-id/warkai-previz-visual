# QC — CP002 / 0.2.0

Diuji lokal pada Mac, 16 November 2026. Bukti CP001 di bagian berikut adalah historis; tidak menggantikan uji fitur baru.

| Area CP002 | Bukti |
|---|---|
| Pill kepala bola | UI Chrome native dan MP4 nyata 1280×720 / 30fps / 60 frame / 2 detik; body, bar, kepala terpisah tampak |
| Identitas | Validator menolak nama kosong/duplikat dan kode duplikat; migrasi human→pill-person; prompt berisi pemetaan nama/kode |
| Camera line | UI menunjukkan lingkaran solid dan panah arah; tombol OUT memilih gizmo; drag mengubah Z OUT 5→5,278, Undo memulihkan |
| Orbit 360 | MP4 nyata 1280×720 / 30fps / 120 frame / 4 detik; frame 0/30/60/90 diperiksa, posisi depan/samping/belakang/samping berganti |
| Director | UI menerima dolly 50mm 0,9detik dengan koordinat IN/OUT; lensa menjadi 50mm, RAW27frame. Revisi teknis kini menjaga aksi; grammar aksi eksplisit diuji unit |
| Insert | UI menyisip sesudah shot aktif; jumlah 1→2, kamera insert memakai key OUT, total 0,9→5,9detik. Unit memeriksa ID dan offset EDIT |
| Delete/context | Tambah kubus 2→3objek, Backspace 3→2; Backspace kedua tidak menghapus karakter; klik kanan→Hapus dan Undo berjalan |
| Dokumen | TXT/MD, DOCX, PDF fixture dibaca melalui modul nyata; PDF juga diimpor lewat UI lalu ditinjau/dibuka menjadi dua shot 2+3detik, Alya CHAR001/Bima CHAR002 |
| State/light | MP49detik / 270frame30fps; flap, plate, 60frame trueblack, local phone light lalu scene reset. Seluruh piksel60frame black terdekode RGB0 |
| Crop | Dua panel satu sumber gambar dengan crop berbeda dan pertukaran per shot; contact sheet diperiksa; JSON/YAML hasil UI semantik identik |
| Konten terpisah | SQ09 dan SQ07 Pill masing-masing 11detik/330frame30fps. Export teknis selesai, QC visual pemilik konten tetap terpisah |

Pemeriksaan akhir checkpoint: 20 tes model/Director lulus; 1 tes integrasi render lulus; build berhasil (warning ukuran chunk Three.js/PDF); audit dependensi 0 temuan; syntax launcher dan git diff --check lulus. Batas yang belum diuji: DOCX melalui file picker browser (modul ekstraksi fixture lulus), PDF scan/OCR, Safari/Windows/Linux, semua rasio, fallback capture sebagai jalur utama, serta responsif CP002 pada layar kecil. Label key dapat berdekatan pada posisi yang sama; tombol key inspector tetap tersedia.

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

## Engine dan ekspor per klip, 21 November 2026

Uji HTTP dengan FFmpeg/ffprobe lokal mencakup dua POST tertunda, pembatalan dan pemakaian ulang slot encoder, pemulihan batch setelah restart serta dua MP4 dari plan Aragi. Setiap klip memiliki ukuran, durasi, jumlah frame dan SHA-256 yang diukur.

Uji UI pada origin lokal terpisah menggunakan dua karakter Pill dan cerita anonim. Dua klip Clean 720×1280 serta dua Director Breakdown 1280×720 masing-masing berisi 96 frame pada 24 fps (4 detik). Shot pertama melintasi batas klip di frame proyek 96. Kamera kedua mulai di frame proyek 151. QC Director memeriksa 151 frame shot pertama. Penilaian ini berlaku untuk fixture tersebut.

Uji model mengambil 144 frame gerak Pill sebelum dan sesudah dua cut kamera. Posisi, rotasi, fase postur, aksi serta jeda diam cocok pada setiap frame. Uji juga mencakup kamera signed orbit, key yang diedit lewat perintah Director, rig key/fill dan pemulihan preset, tabrakan set serta occlusion/reveal.

Safari pada origin QA terpisah juga memverifikasi edit key kamera pada frame 12 (X 4,25), pemilihan marker, penghapusan key, hold Pill 8 frame yang digunakan kedua kamera, serta fill pada 1,5 dan sakelar bayangan key. Blueprint dibaca kembali setelah perubahan.

Uji pemanggil oleh Aragi dilakukan lewat server lokal terisolasi. POST plan lalu pembuatan batch Clean menghasilkan HTTP 201. Poll manifest dan snapshot mempertahankan hash cerita, kebutuhan produksi, arahan manual, shotIds, [0,96) dan [96,240) pada 24 fps. Batch tersebut berada pada tahap review Director. Pengujian tidak memakai layanan generate.
