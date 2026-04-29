#!/usr/bin/env node

/**
 * WordPress Blog Import Script
 *
 * Fetches all published posts from the WordPress REST API at
 * academy.horizonfx.id and inserts them into the Horizon Trader
 * Platform database as blog articles.
 *
 * Usage:
 *   node scripts/import-wordpress.js
 *
 * Environment variables:
 *   DATABASE_URL  — full PostgreSQL connection string, OR
 *   POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB
 */

const { Pool } = require('pg');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const WP_API_BASE = 'https://academy.horizonfx.id/wp-json/wp/v2/posts';
const PER_PAGE = 100;

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Extract relevant fields from a WordPress REST API post object.
 *
 * @param {object} post — A single post from the WP REST API (with _embed).
 * @returns {{ title: string, contentHtml: string, excerpt: string, slug: string, date: string, featuredImageUrl: string|null }}
 */
function extractPostData(post) {
  const featuredMedia = post._embedded?.['wp:featuredmedia']?.[0];
  return {
    title: post.title.rendered,
    contentHtml: post.content.rendered,
    excerpt: post.excerpt.rendered,
    slug: post.slug,
    date: post.date,
    featuredImageUrl: featuredMedia?.source_url ?? null,
  };
}

module.exports = { extractPostData };

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

function buildPool() {
  const connectionString =
    process.env.DATABASE_URL ||
    `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`;

  return new Pool({ connectionString });
}

async function getAdminUserId(pool) {
  const { rows } = await pool.query(
    'SELECT id FROM users WHERE telegram_id = 0 LIMIT 1'
  );
  if (rows.length === 0) {
    throw new Error('Admin user with telegram_id=0 not found');
  }
  return rows[0].id;
}

async function slugExists(pool, slug) {
  const { rows } = await pool.query(
    'SELECT 1 FROM articles WHERE slug = $1 LIMIT 1',
    [slug]
  );
  return rows.length > 0;
}

async function insertArticle(pool, authorId, data) {
  const { rows } = await pool.query(
    `INSERT INTO articles (author_id, title, content_html, category, source, status, slug, created_at)
     VALUES ($1, $2, $3, 'blog', 'wordpress', 'published', $4, $5)
     RETURNING id`,
    [authorId, data.title, data.contentHtml, data.slug, data.date]
  );
  return rows[0].id;
}

async function insertMedia(pool, articleId, imageUrl) {
  await pool.query(
    `INSERT INTO media (article_id, file_url, media_type)
     VALUES ($1, $2, 'image')`,
    [articleId, imageUrl]
  );
}

// ---------------------------------------------------------------------------
// WordPress API helpers
// ---------------------------------------------------------------------------

async function fetchPage(page) {
  const url = `${WP_API_BASE}?per_page=${PER_PAGE}&page=${page}&_embed`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(
      `WordPress API returned HTTP ${res.status} for page ${page}: ${await res.text()}`
    );
  }

  const totalPages = parseInt(res.headers.get('X-WP-TotalPages') || '1', 10);
  const posts = await res.json();
  return { posts, totalPages };
}

async function fetchAllPosts() {
  const allPosts = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    console.log(`Fetching page ${page}${totalPages > 1 ? ` of ${totalPages}` : ''}...`);
    const result = await fetchPage(page);
    totalPages = result.totalPages;
    allPosts.push(...result.posts);
    page++;
  }

  return allPosts;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  let pool;

  try {
    pool = buildPool();
    // Verify connection
    await pool.query('SELECT 1');
    console.log('Connected to database.');
  } catch (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }

  let authorId;
  try {
    authorId = await getAdminUserId(pool);
    console.log(`Using admin user ${authorId} as author.`);
  } catch (err) {
    console.error(err.message);
    await pool.end();
    process.exit(1);
  }

  let posts;
  try {
    posts = await fetchAllPosts();
    console.log(`Fetched ${posts.length} post(s) from WordPress.`);
  } catch (err) {
    console.error('Failed to fetch WordPress posts:', err.message);
    await pool.end();
    process.exit(1);
  }

  let imported = 0;
  let skipped = 0;

  for (const post of posts) {
    const data = extractPostData(post);

    try {
      if (await slugExists(pool, data.slug)) {
        console.log(`  Skipped (duplicate slug): ${data.slug}`);
        skipped++;
        continue;
      }

      const articleId = await insertArticle(pool, authorId, data);

      if (data.featuredImageUrl) {
        await insertMedia(pool, articleId, data.featuredImageUrl);
      }

      console.log(`  Imported: ${data.slug}`);
      imported++;
    } catch (err) {
      console.error(`  Error importing "${data.slug}":`, err.message);
    }
  }

  console.log('\n--- Import Summary ---');
  console.log(`Total fetched : ${posts.length}`);
  console.log(`Imported      : ${imported}`);
  console.log(`Skipped       : ${skipped}`);

  await pool.end();
}

// Run only when executed directly (not when required for testing)
if (require.main === module) {
  main();
}
