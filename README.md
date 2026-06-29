# Canva Pemalas Adventure

Chrome/Edge extension untuk menjalankan download file Canva berurutan dalam beberapa format: PNG, PDF Standard, PDF Print, dan MP4 Video.

Extension ini **tidak membypass Canva** dan tidak mengambil file langsung dari server Canva. Cara kerjanya adalah mengotomasi klik pada UI Canva yang sedang kamu buka, jadi kamu tetap harus login dan punya akses download untuk desain tersebut.

## Instalasi

1. Buka `chrome://extensions` atau `edge://extensions`.
2. Aktifkan **Developer mode**.
3. Klik **Load unpacked**.
4. Pilih folder ini:

   folder hasil extract repo ini.

## Cara Pakai

1. Buka desain di Canva editor.
2. Pastikan desain sudah selesai loading.
3. Klik ikon extension **Canva Pemalas Adventure** untuk membuka side panel.
4. Pilih format, isi pages per format jika perlu, lalu klik **Download Terpilih**.

Config bisa disimpan di Chrome storage dengan **Save config**, atau dipindahkan antar-PC via **Export Config** dan **Load Config**.

## Catatan

- Kalau Canva mengubah teks atau susunan tombol, automation bisa perlu penyesuaian selector.
- Kalau file besar atau halaman banyak, naikkan jeda antar format ke 5-8 detik.
- Browser mungkin tetap menampilkan prompt lokasi download tergantung pengaturan download kamu.
