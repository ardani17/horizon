#!/usr/bin/env node

/**
 * Fix WordPress Blog Images
 *
 * One-time script to fix lazy-loaded images in already-imported blog articles.
 * Promotes data-src → src and removes lazyload classes so images render
 * without WordPress's lazy-load JavaScript.
 *
 * Usage:
 *   node scripts/fix-blog-images.js
 */

const { Pool } = require('pg');
const { sanitizeWordPressHtml } = require('./import-wordpress');

function buildPool() {
  const connectionString =
    process.env.DATABASE_URL ||
    `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`;

  return new Pool({ connectionString });
}

async function main() {
  let pool;

  try {
    pool = buildPool();
    await pool.query('SELECT 1');
    console.log('Connected to database.');
  } catch (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }

  try {
    // Fetch all blog articles that have data-src (lazy-loaded images)
    const { rows } = await pool.query(
      `SELECT id, slug, content_html FROM articles
       WHERE category = 'blog' AND content_html LIKE '%data-src=%'`
    );

    console.log(`Found ${rows.length} article(s) with lazy-loaded images.`);

    let fixed = 0;
    for (const row of rows) {
      const cleanHtml = sanitizeWordPressHtml(row.content_html);

      if (cleanHtml !== row.content_html) {
        await pool.query(
          'UPDATE articles SET content_html = $1 WHERE id = $2',
          [cleanHtml, row.id]
        );
        console.log(`  Fixed: ${row.slug}`);
        fixed++;
      } else {
        console.log(`  No change: ${row.slug}`);
      }
    }

    console.log(`\n--- Fix Summary ---`);
    console.log(`Total checked : ${rows.length}`);
    console.log(`Fixed         : ${fixed}`);
  } catch (err) {
    console.error('Error fixing articles:', err.message);
    process.exit(1);
  }

  await pool.end();
}

main();
