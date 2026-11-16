# Project format — warkai-previz/2

`examples/quiet-signal.json` adalah proyek lengkap. JSON dan YAML memiliki struktur yang sama. Semua koordinat dalam meter, sistem tangan kanan: X kanan, Y atas, +Z menuju depan stage. Kamera mengarah ke target (bukan rotasi Euler).

## Proyek

- `schema`: `warkai-previz/1` atau `warkai-previz/2`; validator mempromosikan fitur CP002 ke `/2`. CP001 menolak `/2` agar state/cahaya tidak diabaikan.
- `name`, `description`, `setting`: identitas, konsep dan deskripsi geometri lokasi
- `aspect`: 16:9, 9:16, 4:3, 1:1, 21:9 atau 48:9
- `fps`: 24, 25 atau 30
- `light`: preset golden/overcast/night/studio; intensity 0–12; azimuth −180–180°; elevation 5–90°; background dan ground #RRGGBB
- `actors`: objek global; `shots`: urutan RAW

## Objek

```json
{"id":"actor-a","name":"Pemeran A","type":"pill-person","characterTag":"CHAR_001","color":"#d4a961","position":[0,0,0],"rotation":20,"scale":1,"visible":true,"pose":"stand"}
```

Tipe: pill, pill-person, box, sphere, chair, bench, column, rings, panel, glb. Tipe human lama dimigrasikan ke pill-person. Posisi adalah titik akar di lantai, rotasi yaw derajat, skala seragam. `pose` opsional, default stand. Untuk GLB, `asset` berisi data URL model/gltf-binary base64. Tidak ada URL eksternal yang diperlukan. Model dinormalisasi ke tinggi 1,8 m sebelum faktor skala.

## Shot

```yaml
id: shot-example
name: Mendekat
size: MS
duration: 3
purpose: Memperjelas respons pemeran.
action: Pemeran berdiri lalu bergerak mendekat.
sound: Suara ruang. Tanpa dialog atau narator.
notes: Jaga sumbu aksi.
edit:
  sequence_id: SQ01
  job_id: J01
  shot_id: 01A
  raw_in: 0.2
  raw_out: 2.8
  sequence_in: 10
camera:
  movement: dolly
  easing: smooth
  start: {position: [4, 2, 7], target: [0, 1.3, 0], lens: 35}
  end: {position: [2, 1.8, 4], target: [0, 1.3, 0], lens: 50}
  aperture: 2.8
  focus: 4
blocking:
  - actorId: actor-a
    start: [0, 0, 0]
    end: [0, 0, 1]
    action: walk
    poseStart: stand
    poseEnd: stand
    rotationStart: 0
    rotationEnd: 25
```

Ukuran shot: EWS/WS/FS/MS/MCU/CU/ECU/OTS/POV. Label ukuran shot adalah niat sutradara; kamera tetap mengikuti geometri dan lensa numerik, tidak auto-reframe.

Gerak kamera: static/dolly/truck/crane/orbit/handheld. Static menahan posisi awal tetapi tetap dapat mengubah target/lensa. Smooth memakai smoothstep; linear interpolasi linear. Orbit menginterpolasi tinggi/radius serta busur terpendek terhadap target bila `orbitDegrees` kosong. Dengan `orbitDegrees` eksplisit (−1080 sampai 1080), sweep bertanda dipakai: ±360 adalah satu putaran penuh, 720 dua putaran. `setOrbitSweep` menyelaraskan XZ key akhir dengan sweep dan radius akhir. `rollStart/rollEnd` opsional −360..360° diterapkan setelah look-at. Lensa memakai referensi **lebar sensor 36 mm** pada semua aspek. Fokus dan aperture adalah metadata niat kreatif.

Aksi blocking: hold/walk/run/jump/float. Walk/run diberi cue bob/sway, bukan animasi langkah realistis. Postur opsional stand/sit/kneel/crouch/lie. Rotasi opsional memakai yaw dalam derajat dan interpolasi linear. Bila track tidak tersedia, state akhir shot sebelumnya dipertahankan. Postur Pill berupa cue tinggi/siluet, tanpa anggota tubuh atau auto-contact. `pitchStart/End` dan `rollStart/End` opsional diteruskan bersama posisi/yaw.

Satu shot adalah satu segmen waktu lokal. Hard cut terjadi ketika pose kamera segmen berikutnya berbeda. Untuk rangkaian kontinu, samakan end camera/target/lens dengan start segmen berikutnya dan jaga end/start blocking. Pilih easing linear untuk laju konstan. Tidak ada crossfade atau smoothing lintas batas secara otomatis.

## RAW → job → EDIT

`duration` adalah durasi RAW sumber shot. `edit.raw_in` dan `raw_out` adalah trim lokal pada sumber. `edit.sequence_in` adalah awal penempatan hasil trim di timeline sequence.

```
sequence_time = sequence_in + shot_local_time - raw_in
edit_duration = raw_out - raw_in
sequence_edit_out = sequence_in + edit_duration
job_local_in = sum(RAW duration shot sebelumnya dalam sequence_id/job_id yang sama) + raw_in
```

Contoh RAW 3 s, trim 0,2–2,8 s, sequence_in 10 s: footage edit 2,6 s ditempatkan pada sequence 10–12,6 s. Waktu shot 0,2 s dipetakan ke sequence 10 s. Di luar rentang trim, label sequence pada statusbar hanya ekstrapolasi; footage itu tidak termasuk EDIT.

Manifest ekspor memuat `project_raw_in/out`, `shot_local_in/out`, `job_local_in/out`, `sequence_edit_in/out`, fps dan ID produksi. Video versi 0.2 tetap RAW semua shot; gunakan manifest untuk conform manual. Untuk satu video per job, buat satu proyek per job. Mengurut ulang shot mengubah waktu RAW/job; offset EDIT sequence tidak diubah otomatis.

## Pertukaran proyek dan validasi

Import memvalidasi schema, koordinat, warna, ID unik, durasi/frame, kamera, referensi blocking, trim dan batas ukuran. Import gagal tidak mengganti proyek aktif. Model validasi/evaluasi yang sama dipakai UI, render dan prompt builder. JSON adalah format utama untuk interop; YAML menyediakan score yang mudah dibaca/diedit.

`examples/subsecond-30fps.json`: tiga shot 0,8 + 0,9 + 1,3 detik = 90 frame/3 detik, plus cue stand → sit → kneel → stand.

## Identitas dan dimensi CP002

Karakter pill/pill-person dan GLB dengan `role: character` wajib memiliki nama nonkosong unik (case-insensitive) dan `characterTag` unik pola `CHAR_001`. Bila kode tidak ada, validator menetapkannya tanpa mengubah kode eksplisit yang sudah dipakai. Duplikasi karakter mendapat nama dan kode baru; rename tidak mengganti kode. Prompt mencantumkan pemetaan nama/kode/ID objek dan posisi. Kode mencegah ambiguitas handoff, bukan jaminan identitas output generator.

`dimensions: [sx,sy,sz]` adalah faktor skala XYZ di atas `scale` (0,005..100). `pitch/roll` adalah derajat. Pill kepala bola tinggi 1,84 m pada skala 1; Pill sederhana 1,75 m. Panel lebar/tinggi dasar 1 m, pivot tengah bawah, depan +Z, sisi ganda. GLB dinormalisasi tinggi 1,8 m.

## Plate dan state per shot

Objek panel dapat memuat `image` data URL PNG/JPEG/WebP embedded maksimal 4 MB, `imageName`, `unlit`, `emissive` (0..8) dan `imageRegion: [x,y,width,height]`. Region dinormalisasi 0..1 dari sudut **kiri atas**, wajib seluruhnya di dalam sumber. Sumber gambar tidak diubah; UV masing-masing panel terpisah.

`shot.states` berisi maksimal satu override per actorId, field opsional `visible`, `color`, `image`, `imageName`, `imageRegion`, `unlit`, `emissive`, `note`. Override hanya untuk shot tersebut; shot selanjutnya kembali ke state dasar bila tidak punya override. Blocking posisi/postur tetap carry-over. Gambar hanya untuk panel; ID yang hilang/duplikat ditolak.

## Cahaya per shot

`shot.light` opsional: `mode: scene|black|local`, `intensity`, `ambient`, `background`, `practicals` (maksimal empat). Practical berisi `actorId`, `offset: [x,y,z]` (offset sumbu dunia), `color`, `intensity`, `distance`. `black` membersihkan frame kamera/ekspor menjadi RGB 0. `local` mematikan key/ambient dan ground; practical/emisi atau plate unlit harus disebut eksplisit. Diorama dapat tetap memakai panduan untuk mengedit.

## Cerita dan revisi

`sourceStory` mempertahankan nama dokumen, teks asli (maksimal 200.000 karakter), status DRAFT dan metode planner offline. Teks impor diperlakukan sebagai bahan cerita; tidak dijalankan sebagai instruksi sistem. `directorPrompt` merekam revisi terakhir per shot. Teks asli dokumen tidak otomatis dimasukkan seluruhnya ke prompt setiap shot; aksi shot dan data stage menjadi handoff.

`insertShot` menyisip shot di sebelah pilihan, memakai key kamera awal/akhir tetangga, state/cahaya dan aksi sebagai draf. Durasi default 5 detik; ID lama dipertahankan. Shot setelah titik sisip dalam sequence sama digeser pada EDIT. Reorder/duplikat/hapus biasa masih memerlukan peninjauan offset EDIT manual. Jalur kamera dan aktor memakai dua endpoint per shot; waypoint tengah dalam satu shot belum tersedia.
