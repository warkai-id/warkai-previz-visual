# Impor plan Aragi ke Warkai Previz

Plan `aragi.previz.plan.v1` membawa teks final per shot, kebutuhan produksi, profil model dan pembagian klip. Contoh `examples/aragi-manual.plan.json` berasal dari planner Aragi, dengan cerita anonim. Klip pertama memakai frame 0–95, klip kedua frame 96–239, pada 24 fps. Shot pertama melintasi batas klip.

## Data yang diterima

| Field | Makna |
| --- | --- |
| `storyHash`, `shots[].id`, `shots[].text` | Identitas versi cerita serta teks dan ID per shot dari Aragi. Dokumen asli dan karakter pemisah antarparagraf tidak dikirim oleh format v1. |
| `mode`, `requirements` | Pembagian auto/manual dari Aragi dan kebutuhan produksi. |
| `target`, `ratio`, `fps` | Profil kemampuan pada saat plan dibuat, rasio proyek dan frame rate. V1 memakai 24 fps. Rasio harus didukung studio dan tercantum pada profil. |
| `clips[].id`, `order`, `shotIds`, `direction` | Urutan klip, daftar shot sumber dan arahan produksi per klip. |
| `startFrame`, `endFrameExclusive`, `continuesPrevious` | Frame global mulai dari nol. Batas akhir eksklusif. Satu shot sumber dapat berlanjut melintasi dua atau lebih klip. |
| `target.minSeconds`, `target.maxSeconds`, `target.referenceSeconds` | Dua field pertama membatasi durasi keluaran video. Field ketiga membatasi durasi referensi saat nilainya diketahui. Nilai `null` memunculkan catatan pemeriksaan Director. |

Studio menerima 1–120 shot lokal, maksimal 60 detik per shot dan 30 menit per proyek. Saat satu beat sumber melampaui batas durasi shot, Warkai membuat bagian berurutan dari beat itu dengan ID lokal tersendiri. Jika jumlah bagian melebihi kapasitas proyek, impor memberi pesan kesalahan.

## Dari impor ke pengarahan

`projectFromAragiPlan(plan, {name})` mempertahankan salinan plan di `project.aragiPlan`. Teks tiap beat disalin ke `shot.action`. `shot.sourceShotId` merujuk ID Aragi, sedangkan `shot.id` mengidentifikasi shot studio. Setiap proyek diawali satu Pill bernama Karakter 01 dengan kode CHAR_001 dan kamera statis. Director menetapkan pemeran, staging dan gerak kamera sesuai kebutuhan.

Waktu potong di dalam klip belum tersedia di plan v1. Warkai mengusulkan waktu dari proporsi kata dan mencadangkan sedikitnya satu frame bagi setiap shot yang dirujuk. Batas klip manual tetap persis di frame yang dikirim. `aragiWarnings(project)` mengembalikan catatan untuk Director.

## Serah terima ekspor

Panggil `clipsForAragiExport(project)` pada snapshot yang akan dirender. Hasilnya berupa klip urut dengan semua field klip asal, `clipId` dan daftar `warkaiShotIds` yang muncul pada klip itu. Pemetaan dihitung pada frame proyek aktual. Revisi kamera, cahaya atau blocking dapat dirender dengan pembagian semula. Perubahan rasio, fps, total durasi, trim, penempatan edit atau urutan shot yang bertentangan dengan plan memunculkan kesalahan sebelum batch dimulai.

Fixture manual dapat diperiksa menggunakan `node --test src/aragi-plan.test.js`. Uji mencakup validasi profil, pelestarian arahan manual, kontinuitas shot lintas klip, penolakan timeline yang sudah bertentangan dengan plan serta contoh 180 detik menjadi enam klip.
