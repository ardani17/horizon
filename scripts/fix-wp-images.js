#!/usr/bin/env node

/**
 * Fix WordPress Imported Article Images
 *
 * Re-runs sanitizeWordPressHtml on all articles imported from WordPress
 * to fix lazy-loaded images that still have SVG placeholders.
 *
 * Usage:
 *   node scripts/fix-wp-images.js
 *
 * What it does:
 *   1. Finds all articles with source='wordpress'
 *   2. Re-sanitizes their content_html using the updated sanitizer
 *   3. Updates the database with the cleaned HTML
 */

const { Pool } = require('pg');

// Register tsx so we can require TypeScript modules
require('tsx/cjs');

const { sanitizeWordPressHtml } = require('../shared/services/wordpressImport.ts');

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
    // Get all WordPress-imported articles
    const { rows } = await pool.query(
      `SELECT id, slug, content_html FROM articles WHERE source = 'wordpress'`
    );

    console.log(`Found ${rows.length} WordPress articles to re-sanitize.\n`);

    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      const sanitized = sanitizeWordPressHtml(row.content_html);

      if (sanitized !== row.content_html) {
        await pool.query(
          'UPDATE articles SET content_html = $1 WHERE id = $2',
          [sanitized, row.id]
        );
        console.log(`  ✅ Updated: ${row.slug}`);
        updated++;
      } else {
        skipped++;
      }
    }

    console.log('\n--- Fix Summary ---');
    console.log(`Total articles : ${rows.length}`);
    console.log(`Updated        : ${updated}`);
    console.log(`Unchanged      : ${skipped}`);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

main();
