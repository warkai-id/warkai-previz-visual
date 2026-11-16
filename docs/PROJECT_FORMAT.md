# Project format — warkai-previz/1

`examples/quiet-signal.json` adalah proyek lengkap. JSON dan YAML memiliki struktur yang sama. Semua koordinat dalam meter, sistem tangan kanan: X kanan, Y atas, +Z menuju depan stage. Kamera mengarah ke target (bukan rotasi Euler).

## Proyek

- `schema`: `warkai-previz/1`
- `name`, `description`, `setting`: identitas, konsep dan deskripsi geometri lokasi
- `aspect`: 16:9, 9:16, 4:3, 1:1, 21:9 atau 48:9
- `fps`: 24, 25 atau 30
- `light`: preset golden/overcast/night/studio; intensity 0–12; azimuth −180–180°; elevation 5–90°; background dan ground #RRGGBB
- `actors`: objek global; `shots`: urutan RAW

## Objek

```json
{"id":"actor-a","name":"Pemeran A","type":"human","color":"#d4a961","position":[0,0,0],"rotation":20,"scale":1,"visible":true,"pose":"stand"}
```

Tipe: pill, human, box, sphere, chair, bench, column, rings, glb. Posisi adalah titik akar di lantai, rotasi yaw derajat, skala seragam. `pose` opsional, default stand. Untuk GLB, `asset` berisi data URL model/gltf-binary base64. Tidak ada URL eksternal yang diperlukan. Model dinormalisasi ke tinggi 1,8 m sebelum faktor skala.

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

Gerak kamera: static/dolly/truck/crane/orbit/handheld. Static menahan posisi awal tetapi tetap dapat mengubah target/lensa. Smooth memakai smoothstep; linear interpolasi linear. Orbit menginterpolasi tinggi/radius serta busur terpendek terhadap target. Lensa memakai referensi **lebar sensor 36 mm** pada semua aspek. Fokus dan aperture adalah metadata niat kreatif.

Aksi blocking: hold/walk/run/jump/float. Walk/run diberi cue bob/sway, bukan animasi langkah realistis. Postur opsional stand/sit/kneel/crouch/lie. Rotasi opsional memakai yaw dalam derajat dan interpolasi linear. Bila track tidak tersedia, state akhir shot sebelumnya dipertahankan. Postur pill berupa cue tinggi/siluet, mannequin memakai pose anggota tubuh sederhana.

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

Manifest ekspor memuat `project_raw_in/out`, `shot_local_in/out`, `job_local_in/out`, `sequence_edit_in/out`, fps dan ID produksi. Video versi 0.1 tetap RAW semua shot; gunakan manifest untuk conform manual. Untuk satu video per job, buat satu proyek per job. Mengurut ulang shot mengubah waktu RAW/job; offset EDIT sequence tidak diubah otomatis.

## Pertukaran proyek dan validasi

Import memvalidasi schema, koordinat, warna, ID unik, durasi/frame, kamera, referensi blocking, trim dan batas ukuran. Import gagal tidak mengganti proyek aktif. Model validasi/evaluasi yang sama dipakai UI, render dan prompt builder. JSON adalah format utama untuk interop; YAML menyediakan score yang mudah dibaca/diedit.

`examples/subsecond-30fps.json`: tiga shot 0,8 + 0,9 + 1,3 detik = 90 frame/3 detik, plus cue stand → sit → kneel → stand.
