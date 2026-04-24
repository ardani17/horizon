# Requirements Document

## Introduction

Horizon adalah platform komunitas trader yang menggabungkan kemudahan berbagi cerita (storytelling) dengan estetika web era awal 2000-an. Platform ini menangkap momen-momen dari grup Telegram komunitas — baik jurnal trading maupun cerita kehidupan — dan menyajikannya dalam bentuk blog yang rapi dan terarsip. Fitur utama meliputi website frontend bergaya retro blogger, admin dashboard untuk moderasi konten, dan integrasi Telegram Bot untuk otomatisasi publikasi konten.

## Glossary

- **Frontend**: Aplikasi web Next.js lastest yang menampilkan konten artikel dan media kepada pengunjung dengan tema retro blogger.
- **Admin_Dashboard**: Antarmuka administrasi untuk moderasi konten, upload manual, dan manajemen pengguna.
- **Telegram_Bot**: Bot service (Golang/Node.js) yang terintegrasi dengan grup Telegram untuk menangkap dan mempublikasikan konten ke platform.
- **Article**: Entitas konten utama yang berisi teks HTML, kategori, sumber, dan status publikasi.
- **Media**: File gambar atau video yang diunggah ke Object Storage dan dapat dikaitkan dengan Article.
- **Category**: Klasifikasi konten yang terdiri dari "trading" (jurnal dan analisa teknikal), "life_story" (cerita kehidupan dan refleksi), "general", dan "outlook" (analisa market mendalam, eksklusif via Dashboard).
- **Object_Storage**: Layanan penyimpanan file S3-compatible menggunakan Cloudflare R2 sebagai pilihan utama (alternatif: Cloudinary/Supabase/AWS) untuk menyimpan media.
- **Member**: Pengguna terdaftar yang terhubung melalui Telegram ID dengan role "member".
- **Admin**: Pengguna terdaftar dengan role "admin" yang memiliki akses penuh ke Admin_Dashboard.
- **Feed**: Tampilan daftar Article secara kronologis pada Frontend.
- **Gallery**: Halaman grid media untuk menampilkan foto dan video dari seluruh Article.
- **Hashtag_Trigger**: Hashtag spesifik dalam pesan Telegram yang menentukan kategori publikasi konten.
- **Story_Command**: Perintah `/story` pada Telegram Bot untuk membuat cerita pendek (short post).
- **Cerita_Command**: Perintah `/cerita` pada Telegram Bot untuk membuat cerita panjang (long-form article).
- **Publish_Command**: Perintah `/publish` pada Telegram Bot untuk mempublikasikan pesan ke platform.
- **Credit**: Mata uang virtual platform yang diperoleh member saat membuat artikel/story, dapat digunakan di tools eksternal.
- **Credit_Balance**: Saldo credit kumulatif yang tersimpan pada record pengguna.
- **Credit_Settings**: Konfigurasi reward credit per kategori artikel yang dapat diatur oleh Admin.
- **Credit_API**: REST API endpoint yang memungkinkan aplikasi eksternal di domain terpisah mengakses dan menggunakan data credit pengguna.

## Requirements

### Requirement 1: Halaman Feed dengan Filter Kategori

**User Story:** Sebagai pengunjung, saya ingin melihat artikel secara kronologis di halaman utama dan bisa memfilter berdasarkan kategori, sehingga saya dapat mengikuti konten terbaru dan fokus pada topik yang saya minati dalam satu halaman.

#### Acceptance Criteria

1. THE Frontend SHALL menampilkan daftar Article dalam urutan kronologis terbalik (terbaru di atas) pada halaman utama (Feed).
2. WHEN pengunjung membuka halaman utama, THE Frontend SHALL memuat Article dengan status "published" dari database, menampilkan semua kategori secara default.
3. THE Frontend SHALL menampilkan judul, cuplikan konten, nama penulis, kategori, dan tanggal publikasi untuk setiap Article di Feed.
4. THE Frontend SHALL menyediakan tab atau tombol filter kategori di bagian atas Feed yang mencakup: "Semua", "Trading Room" (kategori trading), dan "Life & Coffee" (kategori life_story).
5. WHEN pengunjung memilih tab "Trading Room", THE Frontend SHALL menampilkan hanya Article dengan kategori "trading" tanpa berpindah halaman.
6. WHEN pengunjung memilih tab "Life & Coffee", THE Frontend SHALL menampilkan hanya Article dengan kategori "life_story" tanpa berpindah halaman.
7. WHEN pengunjung memilih tab "Semua", THE Frontend SHALL menampilkan semua Article dari seluruh kategori.
8. WHEN jumlah Article melebihi batas per halaman, THE Frontend SHALL menyediakan mekanisme pagination atau infinite scroll untuk navigasi.

### Requirement 3: Halaman Gallery Media (Instagram-Style Grid)

**User Story:** Sebagai pengunjung, saya ingin melihat semua media (foto dan video) dalam tampilan grid bergaya Instagram, sehingga saya dapat menelusuri konten visual komunitas secara cepat dan menarik.

#### Acceptance Criteria

1. THE Frontend SHALL menyediakan halaman Gallery yang menampilkan seluruh Media dalam format grid 3 kolom dengan rasio 1:1 (square) untuk setiap thumbnail, mengadopsi layout grid Instagram.
2. THE Frontend SHALL memotong (crop) Media secara center untuk mengisi area square thumbnail tanpa distorsi.
3. WHEN pengunjung mengarahkan kursor ke thumbnail Media, THE Frontend SHALL menampilkan overlay dengan informasi singkat (judul artikel terkait dan tipe media).
4. WHEN pengunjung mengklik thumbnail Media, THE Frontend SHALL menampilkan Media dalam modal/lightbox overlay tanpa berpindah halaman — menampilkan gambar ukuran penuh atau video player built-in.
5. THE Frontend SHALL menampilkan ikon play indicator pada thumbnail Media bertipe "video" untuk membedakannya dari gambar.
6. WHEN pengunjung mengakses halaman Gallery, THE Frontend SHALL memuat Media dari Object_Storage dan menampilkannya secara kronologis terbalik (terbaru di atas).
7. WHEN pengunjung scroll mendekati akhir grid, THE Frontend SHALL memuat Media tambahan secara otomatis menggunakan infinite scroll tanpa perlu klik pagination.
8. WHILE lebar layar perangkat di bawah 768px, THE Frontend SHALL menampilkan Gallery dalam format grid 3 kolom dengan ukuran thumbnail yang lebih kecil menyesuaikan lebar layar, konsisten dengan tampilan Instagram mobile.

### Requirement 4: Tema Retro Blogger

**User Story:** Sebagai pengunjung, saya ingin merasakan estetika web era awal 2000-an saat mengakses platform, sehingga pengalaman membaca terasa nostalgik dan unik.

#### Acceptance Criteria

1. THE Frontend SHALL menggunakan palet warna utama Emerald Green, Dark Slate, dan Off-White untuk latar belakang.
2. THE Frontend SHALL menampilkan layout sidebar klasik dengan navigasi kategori dan informasi komunitas.
3. THE Frontend SHALL menggunakan border tegas dan tipografi Sans-serif dengan gaya header "boxy" sesuai estetika retro blogger.
4. THE Frontend SHALL mengoptimalkan kecepatan load halaman dengan target Largest Contentful Paint (LCP) di bawah 2.5 detik.

### Requirement 5: Moderasi Konten oleh Admin

**User Story:** Sebagai admin, saya ingin dapat mengedit, menyembunyikan, atau menghapus kiriman dari Telegram, sehingga saya dapat menjaga kualitas konten di platform.

#### Acceptance Criteria

1. WHEN Admin mengakses Admin_Dashboard, THE Admin_Dashboard SHALL menampilkan daftar seluruh Article beserta status publikasinya.
2. WHEN Admin memilih untuk mengedit Article, THE Admin_Dashboard SHALL menyediakan form editor untuk mengubah konten HTML dan metadata Article.
3. WHEN Admin mengubah status Article menjadi "hidden", THE Frontend SHALL berhenti menampilkan Article tersebut di Feed dan Gallery.
4. WHEN Admin menghapus Article, THE Admin_Dashboard SHALL menghapus Article beserta Media terkait dari database dan Object_Storage.
5. IF Admin yang tidak terautentikasi mencoba mengakses Admin_Dashboard, THEN THE Admin_Dashboard SHALL menolak akses dan menampilkan halaman login.

### Requirement 6: Upload Manual oleh Admin

**User Story:** Sebagai admin, saya ingin dapat memposting artikel atau media secara langsung melalui dashboard, sehingga saya dapat menambahkan konten tanpa melalui Telegram.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL menyediakan form upload untuk membuat Article baru dengan field konten HTML, kategori, dan lampiran Media.
2. WHEN Admin mengirimkan form upload, THE Admin_Dashboard SHALL menyimpan Article ke database dengan source "dashboard" dan status "published".
3. WHEN Admin melampirkan file Media pada form upload, THE Admin_Dashboard SHALL mengunggah file ke Object_Storage dan menyimpan referensi URL di tabel media.
4. IF file Media yang diunggah bukan bertipe gambar atau video, THEN THE Admin_Dashboard SHALL menolak file dan menampilkan pesan error yang deskriptif.

### Requirement 7: Manajemen Pengguna

**User Story:** Sebagai admin, saya ingin melihat dan mengelola daftar member yang terhubung melalui Telegram, sehingga saya dapat mengontrol akses dan informasi pengguna.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL menampilkan daftar seluruh pengguna terdaftar beserta Telegram ID, username, role, dan tanggal registrasi.
2. WHEN Admin mengubah role pengguna, THE Admin_Dashboard SHALL memperbarui role pengguna di database.
3. WHEN pengguna baru terhubung melalui Telegram_Bot, THE Admin_Dashboard SHALL menampilkan pengguna tersebut di daftar secara otomatis setelah halaman dimuat ulang.

### Requirement 8: Publikasi Konten via Hashtag dan Command Telegram

**User Story:** Sebagai member komunitas, saya ingin memposting konten ke platform dengan menggunakan hashtag atau command di grup Telegram, sehingga saya dapat berbagi jurnal, cerita pendek, atau cerita panjang tanpa meninggalkan Telegram.

#### Acceptance Criteria

1. WHEN member mengirim pesan dengan hashtag `#jurnal` atau `#trading` di grup Telegram, THE Telegram_Bot SHALL membuat Article baru dengan kategori "trading" dan status "published".
2. WHEN member mengirim pesan dengan hashtag `#cerita` atau `#kehidupan` di grup Telegram, THE Telegram_Bot SHALL membuat Article baru dengan kategori "life_story" dan status "published".
3. WHEN member mengirim command `/story` diikuti teks di grup Telegram, THE Telegram_Bot SHALL membuat Article baru dengan kategori "life_story", content_type "short", dan status "published" — ditampilkan sebagai cerita pendek di Frontend.
4. WHEN member mengirim command `/cerita` diikuti teks di grup Telegram, THE Telegram_Bot SHALL membuat Article baru dengan kategori "life_story", content_type "long", dan status "published" — ditampilkan sebagai cerita panjang (long-form) di Frontend.
5. WHEN pesan Telegram mengandung teks, THE Telegram_Bot SHALL mengkonversi teks pesan menjadi konten HTML dan menyimpannya sebagai content_html pada Article.
6. THE Frontend SHALL membedakan tampilan Article berdasarkan content_type: "short" ditampilkan sebagai card ringkas di Feed, sedangkan "long" ditampilkan dengan layout baca panjang yang nyaman (full-width, tipografi lebih besar, spacing lebih lega).
7. IF pesan Telegram tidak mengandung Hashtag_Trigger atau command yang valid, THEN THE Telegram_Bot SHALL mengabaikan pesan tersebut dan tidak membuat Article.

### Requirement 9: Publikasi Konten via Command /publish

**User Story:** Sebagai admin, saya ingin mempublikasikan pesan tertentu di grup Telegram ke platform menggunakan command `/publish`, sehingga saya dapat memilih konten spesifik untuk dipublikasikan.

#### Acceptance Criteria

1. WHEN Admin membalas pesan di grup Telegram dengan command `/publish`, THE Telegram_Bot SHALL membuat Article baru dari pesan yang dibalas.
2. WHEN pesan yang dibalas tidak mengandung Hashtag_Trigger, THE Telegram_Bot SHALL membuat Article dengan kategori "general".
3. WHEN pesan yang dibalas mengandung Hashtag_Trigger, THE Telegram_Bot SHALL menggunakan kategori sesuai mapping hashtag yang berlaku.
4. IF pengguna non-Admin mengirim command `/publish`, THEN THE Telegram_Bot SHALL mengabaikan command tersebut dan mengirim pesan notifikasi bahwa hanya Admin yang dapat menggunakan command ini.

### Requirement 10: Penanganan Media dari Telegram

**User Story:** Sebagai member komunitas, saya ingin foto dan video yang saya kirim bersama pesan di Telegram otomatis tersimpan di platform, sehingga konten visual saya terarsip dengan baik.

#### Acceptance Criteria

1. WHEN pesan Telegram yang dipublikasikan mengandung foto, THE Telegram_Bot SHALL mengunduh foto dari Telegram API dan mengunggahnya ke Object_Storage.
2. WHEN pesan Telegram yang dipublikasikan mengandung video, THE Telegram_Bot SHALL mengunduh video dari Telegram API dan mengunggahnya ke Object_Storage.
3. WHEN Media berhasil diunggah ke Object_Storage, THE Telegram_Bot SHALL menyimpan record Media di database dengan file_url yang mengarah ke Object_Storage dan mengaitkannya dengan Article terkait.
4. IF proses unduh atau unggah Media gagal, THEN THE Telegram_Bot SHALL mencatat error ke log dan tetap mempublikasikan Article tanpa Media.

### Requirement 11: Registrasi Pengguna Otomatis dan Validasi Keanggotaan Grup

**User Story:** Sebagai member grup Horizon di Telegram, saya ingin otomatis memiliki akses untuk upload artikel via bot tanpa registrasi manual, sehingga saya bisa langsung berkontribusi selama saya terdaftar sebagai anggota grup.

#### Acceptance Criteria

1. WHEN Telegram_Bot menerima pesan dengan Hashtag_Trigger atau command dari pengguna, THE Telegram_Bot SHALL memvalidasi bahwa pengguna tersebut adalah member aktif di grup Horizon Telegram sebelum memproses publikasi.
2. IF pengguna yang mengirim pesan bukan member grup Horizon Telegram, THEN THE Telegram_Bot SHALL mengabaikan pesan tersebut dan tidak membuat Article.
3. WHEN pengguna yang merupakan member grup mengirim konten untuk pertama kali dan belum terdaftar di database, THE Telegram_Bot SHALL membuat record pengguna baru secara otomatis dengan telegram_id, username dari Telegram, role "member", dan timestamp registrasi.
4. WHEN pengguna sudah terdaftar di database, THE Telegram_Bot SHALL menggunakan record pengguna yang ada sebagai author_id untuk Article baru.
5. THE Telegram_Bot SHALL memastikan setiap telegram_id bersifat unik di tabel users.
6. IF member keluar atau dikeluarkan dari grup Horizon Telegram, THEN THE Telegram_Bot SHALL tidak lagi memproses pesan dari pengguna tersebut untuk publikasi, namun data dan artikel yang sudah ada tetap tersimpan di database.

### Requirement 12: Skema Database

**User Story:** Sebagai developer, saya ingin skema database yang terstruktur dan konsisten, sehingga data platform tersimpan dengan integritas yang terjaga.

#### Acceptance Criteria

1. THE Database SHALL menyimpan data pengguna di tabel "users" dengan kolom id (UUID, Primary Key), telegram_id (BIGINT, Unique), username (VARCHAR), role (VARCHAR), credit_balance (INTEGER, default 0), dan created_at (TIMESTAMP).
2. THE Database SHALL menyimpan data artikel di tabel "articles" dengan kolom id (UUID, Primary Key), author_id (UUID, Foreign Key ke users), content_html (TEXT), category (VARCHAR), content_type (VARCHAR: short, long, default "short"), source (VARCHAR), status (VARCHAR), slug (VARCHAR, Unique), dan created_at (TIMESTAMP).
3. THE Database SHALL menyimpan data media di tabel "media" dengan kolom id (UUID, Primary Key), article_id (UUID, Foreign Key ke articles, nullable), file_url (VARCHAR), media_type (VARCHAR), dan created_at (TIMESTAMP).
4. THE Database SHALL menyimpan data credit di tabel "credit_transactions" dengan kolom id (UUID, Primary Key), user_id (UUID, Foreign Key ke users), amount (INTEGER), transaction_type (VARCHAR: earned, spent, adjusted), source_type (VARCHAR: article_trading, article_life_story, article_general, manual_admin, external_tool), source_id (UUID, nullable, referensi ke article atau entitas sumber), description (TEXT, nullable), dan created_at (TIMESTAMP).
5. THE Database SHALL menyimpan konfigurasi reward di tabel "credit_settings" dengan kolom id (UUID, Primary Key), category (VARCHAR, Unique: trading, life_story, general), credit_reward (INTEGER), is_active (BOOLEAN, default true), dan updated_at (TIMESTAMP).
6. THE Database SHALL menjaga referential integrity antara tabel articles dan users melalui foreign key author_id.
7. THE Database SHALL menjaga referential integrity antara tabel media dan articles melalui foreign key article_id.
8. THE Database SHALL menjaga referential integrity antara tabel credit_transactions dan users melalui foreign key user_id.
9. THE Database SHALL menyimpan data activity log di tabel "activity_logs" dengan kolom id (UUID, Primary Key), actor_id (UUID, nullable, Foreign Key ke users), actor_type (VARCHAR), action (VARCHAR), target_type (VARCHAR), target_id (UUID, nullable), details (JSONB), ip_address (VARCHAR, nullable), dan created_at (TIMESTAMP).
10. THE Database SHALL menyimpan data komentar di tabel "comments" dengan kolom id (UUID, Primary Key), article_id (UUID, Foreign Key ke articles), user_id (UUID, nullable, Foreign Key ke users), display_name (VARCHAR), content (TEXT), is_anonymous (BOOLEAN), status (VARCHAR: visible, hidden), dan created_at (TIMESTAMP).
11. THE Database SHALL menyimpan data like di tabel "likes" dengan kolom id (UUID, Primary Key), article_id (UUID, Foreign Key ke articles), fingerprint (VARCHAR, Unique per article_id), dan created_at (TIMESTAMP).

### Requirement 13: Deployment dan Infrastruktur Docker

**User Story:** Sebagai developer, saya ingin seluruh platform berjalan di Docker dengan konfigurasi yang mudah dikelola, sehingga deployment dan scaling dapat dilakukan secara konsisten di lingkungan manapun.

#### Acceptance Criteria

1. THE Deployment SHALL menyediakan file `docker-compose.yml` yang mendefinisikan seluruh service: Frontend (Next.js), Telegram_Bot, PostgreSQL, dan Nginx sebagai reverse proxy.
2. THE Deployment SHALL menggunakan multi-stage Docker build untuk Frontend guna memisahkan tahap dependency installation, build, dan production runtime agar ukuran image tetap minimal.
3. THE Deployment SHALL menggunakan multi-stage Docker build untuk Telegram_Bot guna mengoptimalkan ukuran image produksi.
4. THE Deployment SHALL menyimpan seluruh konfigurasi sensitif (database credentials, Telegram Bot token, Object Storage keys) dalam file `.env` yang direferensikan oleh Docker Compose dan TIDAK disertakan dalam version control.
5. THE Deployment SHALL mengkonfigurasi Nginx sebagai reverse proxy dengan SSL certificate dari Let's Encrypt untuk mengamankan traffic HTTPS.
6. WHEN Docker container mengalami crash, THE Deployment SHALL melakukan restart otomatis menggunakan restart policy `unless-stopped` pada setiap service.
7. THE Deployment SHALL menggunakan Docker named volumes untuk menyimpan data PostgreSQL agar data persisten meskipun container di-recreate.
8. THE Deployment SHALL mendefinisikan Docker network internal agar komunikasi antar service (Frontend, Bot, Database) terisolasi dari jaringan eksternal.
9. THE Deployment SHALL menyediakan health check pada setiap service untuk memastikan container berjalan dengan benar sebelum menerima traffic.
10. THE Deployment SHALL menyimpan file Media di S3-compatible Object_Storage yang terpisah dari application server.

### Requirement 14: Desain Responsif untuk Desktop dan Mobile

**User Story:** Sebagai pengunjung, saya ingin mengakses platform dengan tampilan yang optimal di perangkat desktop maupun mobile, sehingga saya dapat menikmati konten komunitas dengan nyaman dari perangkat apapun.

#### Acceptance Criteria

1. THE Frontend SHALL menampilkan layout yang menyesuaikan secara otomatis berdasarkan lebar layar perangkat dengan breakpoint untuk desktop (di atas 1024px), tablet (768px hingga 1024px), dan mobile (di bawah 768px).
2. WHILE lebar layar perangkat di bawah 768px, THE Frontend SHALL menyembunyikan sidebar navigasi dan menampilkan ikon hamburger menu sebagai pengganti.
3. WHEN pengunjung menekan ikon hamburger menu pada tampilan mobile, THE Frontend SHALL menampilkan sidebar navigasi sebagai overlay yang dapat ditutup kembali.
4. WHILE lebar layar perangkat di bawah 768px, THE Frontend SHALL menampilkan Gallery dalam format grid satu atau dua kolom yang menyesuaikan lebar layar.
5. WHILE lebar layar perangkat di bawah 768px, THE Frontend SHALL menampilkan konten Article di Feed dengan lebar penuh dan ukuran tipografi yang mudah dibaca pada layar kecil.
6. THE Frontend SHALL menampilkan elemen navigasi dan tombol interaktif dengan ukuran minimum 44x44 piksel pada tampilan mobile untuk mendukung interaksi sentuh.
7. THE Frontend SHALL menggunakan meta tag viewport yang sesuai untuk memastikan rendering yang benar pada perangkat mobile.
### Requirement 15: Arsitektur Bot Extensible dan Integrasi Web API

**User Story:** Sebagai admin, saya ingin arsitektur Telegram Bot yang modular dan extensible, sehingga saya dapat menambahkan command baru dengan mudah dan mengintegrasikannya dengan web tanpa harus mengubah kode inti bot.

#### Acceptance Criteria

1. THE Telegram_Bot SHALL menggunakan arsitektur command handler berbasis registry pattern, di mana setiap command didefinisikan sebagai modul terpisah yang dapat didaftarkan tanpa mengubah kode inti bot.
2. THE Telegram_Bot SHALL menyediakan interface atau contract standar untuk setiap command handler yang mencakup nama command, deskripsi, permission level (admin/member), dan fungsi eksekusi.
3. WHEN admin mendaftarkan command handler baru ke registry, THE Telegram_Bot SHALL secara otomatis mengenali dan mengaktifkan command tersebut tanpa perlu restart manual.
4. THE Telegram_Bot SHALL menyediakan REST API internal yang memungkinkan Frontend dan Admin_Dashboard berkomunikasi dengan bot untuk operasi seperti mengirim notifikasi, mengambil status bot, dan memicu aksi tertentu.
5. THE Frontend SHALL dapat memanggil REST API internal Telegram_Bot melalui Docker network untuk menampilkan status bot dan statistik penggunaan command di Admin_Dashboard.
6. WHEN command baru ditambahkan yang menghasilkan data untuk web, THE Telegram_Bot SHALL menyimpan data tersebut ke database PostgreSQL menggunakan skema yang konsisten dengan tabel yang sudah ada.
7. THE Telegram_Bot SHALL menyediakan middleware pipeline yang memungkinkan penambahan validasi, logging, atau rate limiting pada command tanpa mengubah logic handler.
8. IF command yang tidak terdaftar dikirim oleh pengguna, THEN THE Telegram_Bot SHALL mengabaikan command tersebut atau mengirim pesan bantuan yang menampilkan daftar command yang tersedia.

### Requirement 16: Sistem Credit untuk Member

**User Story:** Sebagai member komunitas, saya ingin mendapatkan credit setiap kali saya membuat artikel atau story, sehingga kontribusi saya dihargai dan credit tersebut dapat digunakan di tools eksternal.

#### Acceptance Criteria

1. WHEN Article baru dengan status "published" berhasil dibuat oleh member (baik via Telegram maupun Dashboard), THE Platform SHALL menambahkan credit ke saldo pengguna sesuai dengan konfigurasi reward untuk kategori Article tersebut.
2. THE Platform SHALL menghitung jumlah credit reward berdasarkan tabel "credit_settings" yang menyimpan nilai credit per kategori (trading, life_story, general).
3. WHEN credit ditambahkan ke saldo pengguna, THE Platform SHALL membuat record transaksi di tabel "credit_transactions" dengan transaction_type "earned", source_type sesuai kategori artikel, dan source_id yang merujuk ke Article terkait.
4. THE Platform SHALL memperbarui kolom credit_balance pada tabel users secara atomik setiap kali terjadi transaksi credit untuk menjaga konsistensi data.
5. IF Article yang sudah memberikan credit dihapus atau diubah statusnya menjadi "hidden" oleh Admin, THEN THE Platform SHALL TIDAK mengurangi credit yang sudah diberikan (credit bersifat final setelah earned).
6. THE Admin_Dashboard SHALL menampilkan saldo credit setiap member di halaman manajemen pengguna.

### Requirement 17: Konfigurasi Reward Credit oleh Admin

**User Story:** Sebagai admin, saya ingin dapat mengatur berapa credit yang diberikan untuk setiap kategori artikel, sehingga saya dapat menyesuaikan insentif berdasarkan prioritas komunitas.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL menyediakan halaman pengaturan credit yang menampilkan daftar kategori (trading, life_story, general) beserta nilai credit reward masing-masing.
2. WHEN Admin mengubah nilai credit reward untuk suatu kategori, THE Admin_Dashboard SHALL memperbarui record di tabel "credit_settings" dan perubahan berlaku untuk Article yang dibuat setelahnya.
3. WHEN Admin menonaktifkan reward untuk suatu kategori (is_active = false), THE Platform SHALL tidak memberikan credit untuk Article baru pada kategori tersebut.
4. THE Admin_Dashboard SHALL menyediakan fitur untuk melakukan penyesuaian credit manual (menambah atau mengurangi) pada saldo member tertentu dengan transaction_type "adjusted" dan deskripsi alasan.
5. THE Admin_Dashboard SHALL menampilkan riwayat transaksi credit per member yang mencakup jumlah, tipe transaksi, sumber, dan tanggal.

### Requirement 18: Credit API untuk Akses Eksternal

**User Story:** Sebagai developer tools eksternal, saya ingin mengakses data credit pengguna melalui API yang aman, sehingga tools di domain terpisah dapat membaca dan menggunakan saldo credit member.

#### Acceptance Criteria

1. THE Platform SHALL menyediakan REST API endpoint publik untuk mengakses data credit pengguna, termasuk endpoint untuk membaca saldo credit dan riwayat transaksi berdasarkan user_id atau telegram_id.
2. THE Credit API SHALL menggunakan API key authentication, di mana setiap aplikasi eksternal harus menyertakan API key yang valid di header request untuk mengakses data.
3. THE Admin_Dashboard SHALL menyediakan fitur untuk membuat, melihat, dan merevoke API key yang digunakan oleh aplikasi eksternal.
4. THE Credit API SHALL menyediakan endpoint untuk mengurangi credit pengguna (spend) yang hanya dapat dipanggil oleh aplikasi eksternal terautentikasi, dengan transaction_type "spent" dan source_type "external_tool".
5. WHEN aplikasi eksternal mengirim request spend credit, THE Credit API SHALL memvalidasi bahwa saldo credit pengguna mencukupi sebelum mengurangi credit.
6. IF saldo credit pengguna tidak mencukupi untuk operasi spend, THEN THE Credit API SHALL menolak request dengan response error yang menjelaskan saldo tidak cukup.
7. THE Credit API SHALL menerapkan rate limiting untuk mencegah penyalahgunaan akses dari aplikasi eksternal.
8. THE Credit API SHALL mendukung CORS configuration yang memungkinkan akses dari domain tertentu yang telah didaftarkan oleh Admin.

### Requirement 19: Performa dan Kecepatan Loading Website

**User Story:** Sebagai pengunjung, saya ingin website memuat dengan cepat di semua halaman, sehingga saya tidak perlu menunggu lama untuk membaca konten komunitas.

#### Acceptance Criteria

1. THE Frontend SHALL menggunakan Next.js Server-Side Rendering (SSR) atau Static Site Generation (SSG) untuk halaman publik (Feed, Gallery, detail Article) agar konten tersedia tanpa menunggu client-side rendering.
2. THE Frontend SHALL mengoptimalkan gambar menggunakan Next.js Image component dengan format WebP/AVIF otomatis, lazy loading, dan ukuran responsif berdasarkan viewport.
3. THE Frontend SHALL menerapkan code splitting otomatis per halaman dan dynamic import untuk komponen berat (video player, lightbox, editor) agar bundle JavaScript awal tetap minimal.
4. THE Frontend SHALL mengimplementasikan caching strategy menggunakan HTTP Cache-Control headers untuk aset statis (gambar, CSS, JS) dengan max-age minimal 1 tahun dan content hashing untuk cache busting.
5. THE Frontend SHALL mencapai skor Core Web Vitals yang baik: Largest Contentful Paint (LCP) di bawah 2.5 detik, First Input Delay (FID) di bawah 100ms, dan Cumulative Layout Shift (CLS) di bawah 0.1.
6. THE Frontend SHALL menerapkan lazy loading untuk Media di halaman Gallery dan Feed, memuat hanya Media yang terlihat di viewport dan memuat sisanya saat pengunjung scroll.
7. THE Frontend SHALL menggunakan font loading strategy dengan `font-display: swap` dan preload untuk font utama agar teks langsung terlihat tanpa menunggu font selesai dimuat.
8. WHEN pengunjung mengakses halaman yang membutuhkan data dari database, THE Frontend SHALL menampilkan skeleton loading placeholder yang sesuai layout konten untuk menghindari layout shift.

### Requirement 20: Berbagi Artikel ke Media Sosial

**User Story:** Sebagai creator yang menulis artikel, saya ingin bisa membagikan artikel saya ke Instagram, Facebook, Threads, dan X (Twitter), sehingga konten saya dapat menjangkau audiens yang lebih luas di luar platform.

#### Acceptance Criteria

1. THE Frontend SHALL menampilkan tombol share pada setiap halaman detail Article untuk platform: X (Twitter), Facebook, Threads, dan Instagram.
2. WHEN creator menekan tombol share X (Twitter), THE Frontend SHALL membuka jendela baru dengan URL share Twitter yang berisi judul artikel, cuplikan singkat, dan link ke halaman artikel.
3. WHEN creator menekan tombol share Facebook, THE Frontend SHALL membuka jendela baru dengan URL share Facebook yang berisi link ke halaman artikel.
4. WHEN creator menekan tombol share Threads, THE Frontend SHALL membuka jendela baru dengan URL share Threads yang berisi teks dan link ke halaman artikel.
5. WHEN creator menekan tombol share Instagram, THE Frontend SHALL menyalin link artikel ke clipboard dan menampilkan notifikasi bahwa link telah disalin dan siap ditempel di Instagram Story atau Bio, karena Instagram tidak mendukung direct URL sharing.
6. THE Frontend SHALL menyediakan Open Graph meta tags (og:title, og:description, og:image, og:url) dan Twitter Card meta tags pada setiap halaman detail Article agar preview link tampil dengan baik saat dibagikan di media sosial.
7. THE Frontend SHALL menggunakan gambar Media pertama dari Article sebagai og:image, atau fallback ke gambar default platform jika Article tidak memiliki Media.
8. THE Frontend SHALL menyediakan tombol "Copy Link" sebagai opsi tambahan untuk menyalin URL artikel ke clipboard.

### Requirement 21: Optimasi SEO

**User Story:** Sebagai pemilik platform, saya ingin website dioptimalkan untuk mesin pencari, sehingga konten komunitas mudah ditemukan oleh audiens baru melalui Google dan mesin pencari lainnya.

#### Acceptance Criteria

1. THE Frontend SHALL menghasilkan halaman HTML yang fully rendered di server (SSR/SSG) agar konten dapat di-crawl oleh mesin pencari tanpa bergantung pada JavaScript client-side.
2. THE Frontend SHALL menyediakan meta tags yang unik dan relevan (title, description) pada setiap halaman, termasuk halaman utama, halaman kategori, halaman detail Article, dan halaman Gallery.
3. THE Frontend SHALL menghasilkan title tag dengan format yang konsisten, contoh: "[Judul Artikel] | Horizon" untuk halaman detail dan "Trading Room | Horizon" untuk halaman kategori.
4. THE Frontend SHALL menyediakan sitemap.xml yang diperbarui secara otomatis setiap kali Article baru dipublikasikan, mencakup URL seluruh halaman publik beserta lastmod date.
5. THE Frontend SHALL menyediakan file robots.txt yang mengizinkan crawling pada halaman publik dan memblokir akses ke Admin_Dashboard dan API endpoint internal.
6. THE Frontend SHALL mengimplementasikan URL yang bersih dan deskriptif (slug) untuk setiap Article, contoh: `/artikel/judul-artikel-yang-relevan`.
7. THE Frontend SHALL menyediakan structured data (JSON-LD) bertipe Article pada setiap halaman detail Article yang mencakup headline, author, datePublished, image, dan description.
8. THE Frontend SHALL menggunakan tag heading (H1, H2, H3) secara hierarkis dan semantik pada setiap halaman untuk membantu mesin pencari memahami struktur konten.
9. THE Frontend SHALL menyediakan canonical URL pada setiap halaman untuk menghindari duplikasi konten di indeks mesin pencari.
10. THE Database SHALL menyimpan kolom slug (VARCHAR, Unique) pada tabel articles untuk mendukung URL yang SEO-friendly.

### Requirement 22: Dashboard Statistik dan Profil Member

**User Story:** Sebagai admin, saya ingin memiliki dashboard statistik member dan data profil lengkap, sehingga saya dapat memantau aktivitas komunitas dan mengelola informasi member dengan efektif.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL menyediakan halaman statistik utama yang menampilkan ringkasan: total member terdaftar, total artikel dipublikasikan, total media diunggah, dan total credit yang beredar.
2. THE Admin_Dashboard SHALL menampilkan grafik aktivitas publikasi artikel per hari/minggu/bulan yang dapat difilter berdasarkan rentang waktu.
3. THE Admin_Dashboard SHALL menampilkan grafik distribusi artikel berdasarkan kategori (trading, life_story, general) dalam bentuk chart (pie/bar).
4. THE Admin_Dashboard SHALL menampilkan daftar top contributor — member dengan jumlah artikel terbanyak dan credit tertinggi dalam periode tertentu.
5. THE Admin_Dashboard SHALL menampilkan statistik member aktif vs tidak aktif berdasarkan aktivitas publikasi dalam 30 hari terakhir.
6. WHEN Admin mengklik profil member tertentu, THE Admin_Dashboard SHALL menampilkan halaman detail profil yang mencakup: username, Telegram ID, role, tanggal registrasi, saldo credit, total artikel yang dipublikasikan, dan daftar artikel milik member tersebut.
7. THE Admin_Dashboard SHALL menampilkan riwayat transaksi credit pada halaman profil member, mencakup semua transaksi earned, spent, dan adjusted beserta tanggal dan deskripsi.
8. THE Admin_Dashboard SHALL menampilkan statistik per member: jumlah artikel per kategori, rata-rata artikel per bulan, dan artikel terakhir yang dipublikasikan.

### Requirement 23: Sistem Activity Log dan Audit Trail

**User Story:** Sebagai admin, saya ingin semua aktivitas di platform tercatat dalam log yang dapat dilihat melalui dashboard, sehingga saya dapat memantau, mengaudit, dan mendeteksi aktivitas mencurigakan.

#### Acceptance Criteria

1. THE Platform SHALL mencatat setiap aktivitas ke tabel "activity_logs" dengan kolom id (UUID, Primary Key), actor_id (UUID, nullable, Foreign Key ke users), actor_type (VARCHAR: admin, member, system, external_api), action (VARCHAR), target_type (VARCHAR: article, media, user, credit, setting, api_key), target_id (UUID, nullable), details (JSONB), ip_address (VARCHAR, nullable), dan created_at (TIMESTAMP).
2. THE Platform SHALL mencatat log untuk setiap aktivitas berikut: pembuatan artikel (via Telegram dan Dashboard), pengeditan artikel, penghapusan artikel, perubahan status artikel, upload media, penghapusan media, registrasi pengguna baru, perubahan role pengguna, transaksi credit (earned, spent, adjusted), perubahan credit settings, pembuatan dan revoke API key, login admin, dan akses Credit API dari aplikasi eksternal.
3. THE Admin_Dashboard SHALL menyediakan submenu "Log" yang menampilkan daftar seluruh activity log secara kronologis terbalik (terbaru di atas).
4. THE Admin_Dashboard SHALL menyediakan filter pada halaman Log berdasarkan: rentang waktu, actor (pengguna tertentu), action type, dan target type.
5. THE Admin_Dashboard SHALL menyediakan fitur pencarian pada halaman Log untuk mencari log berdasarkan kata kunci di kolom details atau action.
6. WHEN Admin mengklik entry log tertentu, THE Admin_Dashboard SHALL menampilkan detail lengkap log tersebut termasuk data JSONB details yang berisi informasi sebelum dan sesudah perubahan (before/after state).
7. THE Platform SHALL menyimpan activity log secara immutable — log yang sudah tercatat tidak dapat diedit atau dihapus melalui Admin_Dashboard.
8. THE Platform SHALL mencatat log untuk setiap request ke Credit API dari aplikasi eksternal, termasuk API key yang digunakan, endpoint yang diakses, response status, dan IP address.

### Requirement 24: Penanganan Error yang Jelas dan Terstruktur

**User Story:** Sebagai developer dan admin, saya ingin semua pesan error dari aplikasi web, API, dan bot Telegram ditampilkan secara jelas dan terstruktur, sehingga saya dapat dengan cepat mengidentifikasi dan memperbaiki masalah.

#### Acceptance Criteria

1. THE Platform SHALL menggunakan format error response yang konsisten di seluruh API endpoint dengan struktur: error_code (string unik, contoh: "CREDIT_INSUFFICIENT"), message (deskripsi singkat yang human-readable), details (informasi tambahan kontekstual, nullable), dan timestamp.
2. THE Frontend SHALL menampilkan halaman error yang informatif untuk HTTP error umum (400, 401, 403, 404, 500) dengan pesan yang jelas dalam Bahasa Indonesia, penjelasan singkat penyebab, dan saran tindakan yang bisa dilakukan pengunjung.
3. THE Admin_Dashboard SHALL menampilkan pesan error inline pada form (upload, edit artikel, manajemen pengguna, credit settings) yang menjelaskan secara spesifik field mana yang bermasalah dan apa yang perlu diperbaiki.
4. THE Telegram_Bot SHALL mengirim pesan error yang deskriptif kepada pengguna di Telegram saat terjadi kegagalan, mencakup: apa yang gagal, kemungkinan penyebab, dan saran tindakan — contoh: "Gagal mempublikasikan artikel. Media terlalu besar (maks 50MB). Coba kirim ulang dengan file yang lebih kecil."
5. THE Telegram_Bot SHALL TIDAK menampilkan stack trace, nama tabel database, atau informasi teknis internal dalam pesan error ke pengguna.
6. THE Platform SHALL mencatat error detail (termasuk stack trace, request payload, dan context) ke server log untuk keperluan debugging, terpisah dari pesan error yang ditampilkan ke pengguna.
7. THE Credit API SHALL mengembalikan error response dengan HTTP status code yang tepat (400 untuk bad request, 401 untuk unauthorized, 403 untuk forbidden, 404 untuk not found, 422 untuk validation error, 429 untuk rate limit, 500 untuk server error) beserta error_code yang spesifik.
8. WHEN terjadi error pada proses background (media upload, credit calculation), THE Platform SHALL mencatat error ke activity_logs dengan action "error" dan details yang mencakup error message, stack trace, dan context data.

### Requirement 25: Akses Publik Tanpa Login dan Autentikasi Dashboard

**User Story:** Sebagai pengunjung, saya ingin bisa mengakses seluruh konten website tanpa perlu login, sehingga pengalaman membaca terasa mudah dan tanpa hambatan.

#### Acceptance Criteria

1. THE Frontend SHALL menampilkan seluruh halaman publik (Feed, detail Article, Gallery, halaman kategori) tanpa memerlukan login atau registrasi dari pengunjung.
2. THE Frontend SHALL TIDAK menampilkan tombol login, form registrasi, atau prompt autentikasi pada halaman publik manapun.
3. THE Admin_Dashboard SHALL dilindungi oleh halaman login yang hanya dapat diakses oleh pengguna dengan role "admin".
4. WHEN pengguna mengakses URL Admin_Dashboard tanpa autentikasi, THE Platform SHALL mengarahkan (redirect) pengguna ke halaman login dashboard.
5. WHEN Admin berhasil login, THE Admin_Dashboard SHALL membuat session yang aman dengan expiry time dan menyimpannya menggunakan HTTP-only cookie.
6. WHEN session Admin telah expired, THE Admin_Dashboard SHALL mengarahkan Admin kembali ke halaman login.
7. THE Admin_Dashboard login SHALL menggunakan username dan password yang disimpan secara aman (hashed) di database.

### Requirement 26: Komentar dan Like pada Artikel

**User Story:** Sebagai pengunjung, saya ingin bisa memberikan komentar dan like pada artikel, sehingga saya dapat berinteraksi dengan konten komunitas layaknya media sosial.

#### Acceptance Criteria

1. THE Frontend SHALL menampilkan tombol like dan jumlah like pada setiap halaman detail Article.
2. WHEN pengunjung menekan tombol like, THE Frontend SHALL menambahkan 1 like ke Article dan menyimpannya di database, dengan pembatasan 1 like per perangkat/browser menggunakan fingerprint atau cookie agar tidak bisa spam like.
3. THE Frontend SHALL menampilkan section komentar di bawah setiap halaman detail Article yang menampilkan daftar komentar secara kronologis (terlama di atas).
4. THE Frontend SHALL menyediakan dua opsi untuk berkomentar: "Komentar sebagai Anonim" dan "Login via Telegram".
5. WHEN pengunjung memilih komentar sebagai Anonim, THE Frontend SHALL menampilkan form komentar dengan field nama tampilan (opsional, default "Anonim") dan isi komentar, tanpa memerlukan autentikasi.
6. WHEN pengunjung memilih Login via Telegram, THE Frontend SHALL menggunakan Telegram Login Widget untuk mengautentikasi pengguna dan menampilkan username Telegram sebagai identitas komentar.
7. THE Frontend SHALL menampilkan badge "Member" pada komentar dari pengguna yang login via Telegram dan terdaftar sebagai member di database, untuk membedakan dari komentar anonim.
8. THE Admin_Dashboard SHALL menyediakan fitur moderasi komentar: melihat, menyembunyikan, dan menghapus komentar.
9. THE Database SHALL menyimpan data komentar di tabel "comments" dengan kolom id (UUID, Primary Key), article_id (UUID, Foreign Key ke articles), user_id (UUID, nullable, Foreign Key ke users), display_name (VARCHAR), content (TEXT), is_anonymous (BOOLEAN), status (VARCHAR: visible, hidden), dan created_at (TIMESTAMP).
10. THE Database SHALL menyimpan data like di tabel "likes" dengan kolom id (UUID, Primary Key), article_id (UUID, Foreign Key ke articles), fingerprint (VARCHAR, Unique per article), dan created_at (TIMESTAMP).

### Requirement 27: Halaman Outlook (Analisa Market)

**User Story:** Sebagai pengunjung, saya ingin membaca analisa market yang mendalam dari para trader di halaman Outlook, sehingga saya dapat memahami bagaimana market akan bergerak berdasarkan perspektif komunitas.

#### Acceptance Criteria

1. THE Frontend SHALL menyediakan halaman "Outlook" yang dapat diakses melalui navbar utama, menampilkan daftar artikel analisa market secara kronologis terbalik.
2. THE Frontend SHALL menampilkan artikel Outlook dengan layout long-form reading yang nyaman — full-width content area, tipografi besar, spacing lega, dan dukungan inline image untuk chart dan grafik analisa.
3. THE Frontend SHALL menampilkan tombol like dan section komentar (anonim atau login via Telegram) pada setiap halaman detail Outlook, menggunakan mekanisme yang sama dengan Requirement 26.
4. THE Frontend SHALL menampilkan informasi penulis, tanggal publikasi, dan estimasi waktu baca pada setiap artikel Outlook.
5. THE Admin_Dashboard SHALL menyediakan form upload khusus Outlook dengan rich text editor yang mendukung formatting (heading, bold, italic, list), upload multiple image inline, dan preview sebelum publish.
6. WHEN Admin mempublikasikan artikel Outlook melalui Dashboard, THE Admin_Dashboard SHALL menyimpan Article ke database dengan kategori "outlook", content_type "long", source "dashboard", dan status "published".
7. THE Telegram_Bot SHALL TIDAK memproses atau membuat artikel dengan kategori "outlook" — kategori ini eksklusif hanya bisa dibuat melalui Admin_Dashboard.
8. THE Frontend SHALL membedakan tampilan card Outlook di halaman daftar dengan badge atau label "Outlook" dan thumbnail image pertama dari artikel sebagai cover.
