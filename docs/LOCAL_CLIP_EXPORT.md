# Kontrak render klip lokal

Studio menggunakan browser untuk merender geometri Three.js dan server loopback untuk menyandikan PNG menjadi MP4 H.264 tanpa audio. FFmpeg dan ffprobe diperlukan. Jika keduanya berada di lokasi terpisah, atur `WARKAI_FFMPEG` dan `WARKAI_FFPROBE` pada proses studio.

## Mengirim dari Aragi

Server lokal Aragi dapat mengirim permintaan ke origin Warkai yang sedang aktif. Browser Studio memakai URL relatif di origin Warkai. Sesuaikan port pada klien dengan alamat aktual studio.

1. Kirim `POST /api/previz/batches` dengan JSON `{plan,mode:"clean",width:1280,height:720}`. `plan` adalah isi lengkap `aragi.previz.plan.v1`, misalnya `examples/aragi-manual.plan.json`. Untuk rasio vertikal 9:16 gunakan 720×1280. Mode `breakdown` memakai frame keluaran 16:9, dan menyimpan rasio proyek asli secara terpisah.
2. Respons 201 memberikan `id`, `studioUrl`, `snapshotUrl`, `manifestUrl`, `revision` dan daftar klip urut. Buka `studioUrl` pada origin Warkai untuk mengarahkan proyek. Pembuatan batch menyimpan rencana dan menempatkan klip pada status `pending`. Render memerlukan browser Studio. Plan teks menghasilkan blocking awal yang perlu diarahkan.
3. Setelah pengarahan, ekspor klip dari revisi yang dipilih. Perubahan proyek menghasilkan snapshot dan batch baru. Gunakan ID batch yang benar-benar diekspor untuk polling dan mencatat revisi yang dipakai.
4. Poll `GET /api/previz/batches/{id}`. Nilai status batch adalah `pending`, `rendering`, `partial`, atau `ready`. Untuk setiap klip `ready`, ambil MP4 memakai `GET clip.url` pada origin Warkai. `clip.measured` mencatat codec, ukuran, fps, jumlah frame, durasi detik, ukuran byte, dan SHA-256 file aktual. `visualReview: "pending"` memerlukan penilaian Director.
5. `GET /api/previz/batches` mengembalikan daftar batch lokal. `GET /api/previz/batches/{id}/snapshot` mengambil proyek persis sesuai hash `revision`. Sebelum memulai ulang klip yang masih aktif akibat tab tertutup, lihat status klip dan kirim DELETE ke `cancelUrl` pada klip tersebut. File klip yang sudah selesai tetap dapat diambil.

Paket input dari Studio yang sudah diarahkan adalah `{project,clips,mode,width,height}`. Jika proyek terikat plan Aragi, server menghitung ulang pembagian dari plan dan memeriksa kecocokan dengan timeline. Untuk proyek mandiri, tiap klip memuat `id`, `order`, `startFrame`, `endFrameExclusive` dan `shotIds` dari proyek. Klip harus menutup seluruh timeline RAW dalam urutan frame proyek. Tidak ada reflow durasi saat ekspor.

## Bukti dan pemulihan

Manifest mengikat hasil ke snapshot dengan SHA-256 JSON dan daftar hash byte GLB/plate yang tertanam serta penggunaan objek/shot. `shotIds` menyimpan identitas sumber, sedangkan `sourceShots` menyimpan interval frame Warkai, ID shot/edit dan rentang relatif di file klip. `sourcePlan` memuat hash cerita, kebutuhan produksi, mode pembagian dan profil Aragi yang dikirim. Batas profil mengikuti versi input.

Studio menangkap frame global `f` pada `f / fps` dan hanya mengirim satu job encoder aktif. Setelah semua frame sebuah klip diterima, ffprobe memeriksa hasil encode. Server memublikasikan MP4 dan metadata hasil sebelum klip berikutnya. Data batch tersimpan dalam `.local/previz-batches/` dan terpisah dari Git. Menutup tab atau server di tengah klip memerlukan render ulang klip itu. Klip selesai dapat dipakai kembali setelah restart.

Tes `scripts/clip-export.test.mjs` memakai FFmpeg/ffprobe lokal, server HTTP port acak dan proyek anonim. Satu batch uji melintasi dua shot, berhenti setelah klip pertama, lalu melanjutkan dari snapshot setelah restart. Tes memeriksa hash media unduhan, referensi aset, urutan/timecode, durasi dan jumlah frame hasil decode metadata. Tes lain mengirim fixture Aragi, memeriksa penolakan perubahan arahan manual, serta membatalkan job melalui URL hasil polling. QC artistik dilakukan di Studio.
