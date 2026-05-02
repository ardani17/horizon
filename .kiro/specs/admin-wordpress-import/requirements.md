# Requirements Document

## Introduction

Fitur ini memindahkan proses impor WordPress dari CLI (`node scripts/import-wordpress.js` di dalam Docker container) ke admin dashboard. Administrator dapat memicu impor, memantau progres secara real-time, melihat riwayat impor, dan mengelola data hasil impor — semuanya dari halaman `/admin/blog` tanpa perlu akses terminal atau Docker.

Saat ini, skrip impor sudah ada di `scripts/import-wordpress.js` dan halaman admin blog di `/admin/blog` sudah menampilkan daftar artikel blog yang diimpor. Fitur ini menambahkan:

1. API endpoint untuk memicu impor WordPress dari server-side
2. Mekanisme tracking status dan progres impor
3. UI di halaman admin blog untuk memicu impor dan melihat progres/riwayat
4. Logging aktivitas impor ke `activity_logs`

## Glossary

- **Import_API**: API endpoint Next.js di `/api/wordpress-import` yang menjalankan logika impor WordPress di server-side.
- **Import_Job**: Satu sesi eksekusi impor WordPress, dilacak dengan status (running, completed, failed) dan metadata progres.
- **Import_Status_Table**: Tabel database `wordpress_import_jobs` yang menyimpan riwayat dan status setiap Import_Job.
- **WordPress_API**: REST API endpoint di `https://academy.horizonfx.id/wp-json/wp/v2/posts` yang mengembalikan post WordPress dalam format JSON.
- **Admin_Blog_Page**: Halaman admin dashboard di `/admin/blog` yang menampilkan daftar artikel blog dan kontrol impor.
- **Import_Panel**: Bagian UI di Admin_Blog_Page yang menampilkan tombol impor, status progres, dan riwayat impor.
- **Activity_Log**: Tabel `activity_logs` yang mencatat semua aktivitas sistem termasuk impor WordPress.

## Requirements

### Requirement 1: Tabel Tracking Impor WordPress

**User Story:** Sebagai administrator, saya ingin riwayat impor WordPress tersimpan di database, sehingga saya dapat melihat kapan impor terakhir dijalankan dan hasilnya.

#### Acceptance Criteria

1. THE Import_Status_Table SHALL store each Import_Job with fields: `id` (UUID), `status` (varchar: running, completed, failed), `started_at` (timestamptz), `completed_at` (timestamptz, nullable), `total_fetched` (integer, default 0), `total_imported` (integer, default 0), `total_skipped` (integer, default 0), `total_failed` (integer, default 0), `error_message` (text, nullable), and `triggered_by` (UUID, foreign key to users).
2. WHEN an Import_Job is created, THE Import_Status_Table SHALL set `status` to `running` and `started_at` to the current timestamp.
3. WHEN an Import_Job completes successfully, THE Import_Status_Table SHALL set `status` to `completed` and `completed_at` to the current timestamp.
4. IF an Import_Job encounters a fatal error, THEN THE Import_Status_Table SHALL set `status` to `failed`, `completed_at` to the current timestamp, and `error_message` to the error description.

### Requirement 2: API Endpoint untuk Memicu Impor

**User Story:** Sebagai administrator, saya ingin memicu impor WordPress melalui API, sehingga saya tidak perlu masuk ke Docker container untuk menjalankan skrip CLI.

#### Acceptance Criteria

1. THE Import_API SHALL be accessible at `POST /api/wordpress-import` and require admin authentication via session cookie.
2. IF the request is not authenticated, THEN THE Import_API SHALL return HTTP 401 with error code `AUTH_REQUIRED`.
3. WHEN a valid import request is received, THE Import_API SHALL create a new Import_Job record with status `running` and return HTTP 202 with the job ID.
4. IF an Import_Job with status `running` already exists, THEN THE Import_API SHALL return HTTP 409 with error code `IMPORT_ALREADY_RUNNING` and the existing job ID.
5. THE Import_API SHALL execute the WordPress import logic asynchronously after returning the 202 response, so that the admin dashboard remains responsive.
6. THE Import_API SHALL reuse the existing import logic from `scripts/import-wordpress.js` (fetch posts, extract data, skip duplicates, insert articles and media).
7. WHEN the import process completes, THE Import_API SHALL update the Import_Job record with final counts (`total_fetched`, `total_imported`, `total_skipped`, `total_failed`) and set status to `completed`.
8. IF the import process encounters a fatal error (WordPress API unreachable, database connection failure), THEN THE Import_API SHALL update the Import_Job record with status `failed` and the error message.

### Requirement 3: API Endpoint untuk Status Impor

**User Story:** Sebagai administrator, saya ingin melihat status impor yang sedang berjalan dan riwayat impor sebelumnya, sehingga saya tahu apakah impor berhasil.

#### Acceptance Criteria

1. THE Import_API SHALL support `GET /api/wordpress-import` and require admin authentication via session cookie.
2. IF the request is not authenticated, THEN THE Import_API SHALL return HTTP 401 with error code `AUTH_REQUIRED`.
3. WHEN a GET request is received, THE Import_API SHALL return the most recent Import_Job records ordered by `started_at` descending, with a default limit of 10.
4. THE Import_API SHALL include all Import_Job fields in the response: `id`, `status`, `started_at`, `completed_at`, `total_fetched`, `total_imported`, `total_skipped`, `total_failed`, `error_message`, and the username of the admin who triggered the import.

### Requirement 4: Progres Impor Real-Time

**User Story:** Sebagai administrator, saya ingin melihat progres impor secara real-time di dashboard, sehingga saya tahu berapa post yang sudah diproses.

#### Acceptance Criteria

1. THE Import_API SHALL support `GET /api/wordpress-import/[id]` to return the current status and progress of a specific Import_Job.
2. WHILE an Import_Job has status `running`, THE import process SHALL update the `total_fetched`, `total_imported`, `total_skipped`, and `total_failed` counters in the Import_Status_Table after processing each WordPress post.
3. THE Import_Panel SHALL poll the Import_API status endpoint at regular intervals while an import is running, to display updated progress to the administrator.
4. WHEN the Import_Job status changes to `completed` or `failed`, THE Import_Panel SHALL stop polling and display the final result.

### Requirement 5: UI Panel Impor di Halaman Admin Blog

**User Story:** Sebagai administrator, saya ingin tombol impor dan informasi status di halaman admin blog, sehingga saya dapat mengelola impor WordPress dari satu tempat.

#### Acceptance Criteria

1. THE Import_Panel SHALL be displayed at the top of the Admin_Blog_Page, above the existing article data table.
2. THE Import_Panel SHALL display a button labeled "Impor dari WordPress" that triggers a new import when clicked.
3. WHILE an Import_Job has status `running`, THE Import_Panel SHALL disable the import button and display a progress indicator showing the number of posts fetched, imported, skipped, and failed.
4. WHEN an import completes successfully, THE Import_Panel SHALL display a success message with the import summary (total imported, skipped, failed).
5. IF an import fails, THEN THE Import_Panel SHALL display an error message with the failure reason.
6. THE Import_Panel SHALL display the most recent import job information including: status, timestamp, and summary counts.
7. THE Import_Panel SHALL display a confirmation dialog before starting a new import, with the message "Mulai impor artikel dari WordPress? Artikel dengan slug yang sudah ada akan dilewati."
8. THE Import_Panel SHALL use Indonesian language for all UI text.

### Requirement 6: Logging Aktivitas Impor

**User Story:** Sebagai administrator, saya ingin aktivitas impor tercatat di activity log, sehingga ada audit trail untuk setiap impor yang dijalankan.

#### Acceptance Criteria

1. WHEN an import is triggered, THE Import_API SHALL create an activity log entry with `action` set to `wordpress_import_started`, `actor_type` set to `admin`, `actor_id` set to the admin user ID, and `target_type` set to `article`.
2. WHEN an import completes, THE Import_API SHALL create an activity log entry with `action` set to `wordpress_import_completed` and `details` containing the import summary (total_fetched, total_imported, total_skipped, total_failed).
3. IF an import fails, THEN THE Import_API SHALL create an activity log entry with `action` set to `wordpress_import_failed` and `details` containing the error message.

### Requirement 7: Keamanan dan Pembatasan Akses

**User Story:** Sebagai administrator, saya ingin hanya admin yang terautentikasi yang dapat memicu impor, sehingga tidak ada pihak yang tidak berwenang yang dapat menjalankan impor.

#### Acceptance Criteria

1. THE Import_API SHALL validate the admin session using the existing `validateSession()` function before processing any request.
2. THE Import_API SHALL reject requests without a valid admin session with HTTP 401.
3. THE Import_API SHALL use the authenticated admin's user ID as the `triggered_by` value in the Import_Job record.
4. THE Import_API SHALL use the authenticated admin's user ID as the `author_id` for all imported articles, instead of the hardcoded admin user (telegram_id=0).

### Requirement 8: Kompatibilitas dengan Skrip CLI yang Ada

**User Story:** Sebagai administrator, saya ingin skrip CLI tetap berfungsi sebagai alternatif, sehingga saya memiliki opsi cadangan jika dashboard tidak tersedia.

#### Acceptance Criteria

1. THE existing `scripts/import-wordpress.js` CLI script SHALL continue to function independently of the new Import_API.
2. THE Import_API SHALL reuse the core import logic (post extraction, HTML sanitization, duplicate detection) from the existing import script without duplicating the implementation.
3. WHEN the Import_API imports articles, THE Import_API SHALL use the same database insertion logic (same table, same columns, same category and source values) as the existing CLI script.
