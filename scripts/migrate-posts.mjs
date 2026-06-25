/**
 * One-shot migration script: Hexo legacy-posts/_posts/ → src/content/blog/
 *
 * Usage (from project root):
 *   node scripts/migrate-posts.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync, statSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const require = createRequire(import.meta.url);
const yaml = require(join(ROOT, 'node_modules/js-yaml/index.js'));
const LEGACY_DIR = join(ROOT, 'legacy-posts/_posts');
const OUTPUT_DIR = join(ROOT, 'src/content/blog');
const PLACEHOLDER_SRC = join(LEGACY_DIR, 'hexo.jpg');

// ─── Category mapping ────────────────────────────────────────────────────────

const SLUG_CATEGORY = {
  // takes: personal opinions, reviews, stories
  'christmas': 'takes',
  'copyright-and-morality': 'takes',
  'me-and-zarinpal': 'takes',
  'archusers-telegram-group': 'takes',
  'persepolis': 'takes',
  'persepolis-2-3': 'takes',
  // engineering: everything else (linux tutorials, tools, Hexo how-tos)
};
const DEFAULT_CATEGORY = 'engineering';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hasFarsi(text = '') {
  return /[؀-ۿﭐ-﷿ﹰ-﻿]/.test(text);
}

function sanitizeSlug(raw) {
  // Remove Arabic/Latin question marks and other filesystem-unsafe chars
  return raw
    .replace(/[?؟#*:<>|"\\]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Parse YAML frontmatter from either:
 *  - Standard: ---\n...\n---\n body
 *  - Headerless: YAML starting at line 1 with closing ---
 */
function parseFrontmatter(raw) {
  let fmStr, body;

  if (raw.startsWith('---\n') || raw.startsWith('---\r\n')) {
    const close = raw.indexOf('\n---\n', 4);
    if (close === -1) {
      // No closing ---, treat whole thing as content
      return { fm: {}, body: raw };
    }
    fmStr = raw.slice(4, close);
    body = raw.slice(close + 5);
  } else {
    // Headerless — frontmatter ends at first `\n---\n`
    const close = raw.indexOf('\n---\n');
    if (close !== -1) {
      fmStr = raw.slice(0, close);
      body = raw.slice(close + 5);
    } else {
      return { fm: {}, body: raw };
    }
  }

  let fm = {};
  try {
    fm = yaml.load(fmStr) || {};
  } catch {
    // Fall back to empty frontmatter on parse error
  }
  return { fm, body };
}

function stripMarkdown(text) {
  return text
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*{1,2}(.+?)\*{1,2}/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\{%[^%]+%\}/g, '')
    .replace(/:[a-z_]+:/g, '')  // emoji shortcodes
    .replace(/\n+/g, ' ')
    .trim();
}

function extractExcerpt(body, lang) {
  const moreMatch = body.search(/<!--\s*(more|excerpt)\s*-->/i);
  let raw = moreMatch !== -1
    ? body.slice(0, moreMatch)
    : (body.split(/\n\n+/).find(p => {
        const t = p.trim();
        return t && !t.startsWith('#') && !t.startsWith('```') && !t.startsWith('{% ') && !t.startsWith('{%');
      }) ?? body.slice(0, 400));

  let text = stripMarkdown(raw);

  // Truncate at ~200 chars on a word boundary
  if (text.length > 200) {
    text = text.slice(0, 200).replace(/\s\S*$/, '') + '…';
  }

  return text || (lang === 'fa' ? 'بدون توضیح' : 'No description available.');
}

function readingTime(body, lang) {
  const clean = body
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '');
  const words = clean.split(/\s+/).filter(Boolean).length;
  const wpm = lang === 'fa' ? 150 : 200;
  return Math.max(1, Math.ceil(words / wpm));
}

/**
 * Convert Hexo-specific tag plugins to standard Markdown.
 */
function convertHexoSyntax(body) {
  // {% image fancybox center fig-50 [group:xxx] filename.ext "Caption" %}
  body = body.replace(
    /\{%[-\s]*image\b[^%]*?(\S+\.(?:png|jpe?g|gif|webp|svg))\s+"([^"]+)"\s*[-\s]*%\}/gi,
    (_, file, caption) => `![${caption}](./${file})`
  );
  // {% image ... filename.ext %} (no caption)
  body = body.replace(
    /\{%[-\s]*image\b[^%]*?(\S+\.(?:png|jpe?g|gif|webp|svg))\s*[-\s]*%\}/gi,
    (_, file) => `![](./${file})`
  );

  // {% asset_img filename [optional title] %}
  body = body.replace(
    /\{%[-\s]*asset_img\s+(\S+)(?:\s+([^%\n]+?))?\s*[-\s]*%\}/gi,
    (_, file, title) => `![${(title || '').trim()}](./${file})`
  );

  // {% asset_link filename title %}
  body = body.replace(
    /\{%[-\s]*asset_link\s+(\S+)\s+(['"]?)([^'"%\n]+)\2\s*[-\s]*%\}/gi,
    (_, file, _q, title) => `[${title.trim()}](./${file})`
  );

  // {% link "text" url [extra] %} — optional 3rd arg (display name), ignored
  body = body.replace(
    /\{%[-\s]*link\s+['"]?([^'"%\n}]+?)['"]?\s+(https?:\/\/[^\s%}]+)(?:\s+[^\s%}]+)?\s*[-\s]*%\}/gi,
    (_, text, url) => `[${text.trim()}](${url})`
  );

  // {% blockquote [author] [url] [title] %}...{% endblockquote %}
  body = body.replace(
    /\{%[-\s]*blockquote\b([^%]*?)[-\s]*%\}([\s\S]*?)\{%[-\s]*endblockquote[-\s]*%\}/gi,
    (_, _args, content) =>
      content.trim().split('\n').map(l => '> ' + l).join('\n')
  );

  // Fix multi-line single-backtick spans containing {%...%}: convert to triple-backtick fences
  // (e.g., posts that show Hexo tag syntax as examples)
  body = body.replace(
    /`\n([\s\S]*?\{%[\s\S]*?%\}[\s\S]*?)\n`/g,
    (_, content) => '```\n' + content.trim() + '\n```'
  );

  // Remove excerpt/more markers
  body = body.replace(/<!--\s*(more|excerpt)\s*-->/gi, '');

  // Strip {%raw%} / {%endraw%} wrappers
  body = body.replace(/\{%[-\s]*(?:end)?raw[-\s]*%\}/gi, '');

  return body;
}

/**
 * Copy all files (non-recursively) from srcDir to dstDir.
 */
function copyAssets(srcDir, dstDir) {
  if (!existsSync(srcDir)) return;
  for (const name of readdirSync(srcDir)) {
    const src = join(srcDir, name);
    if (statSync(src).isFile()) {
      copyFileSync(src, join(dstDir, name));
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

const mdFiles = readdirSync(LEGACY_DIR).filter(f => f.endsWith('.md') && !f.startsWith('.'));

console.log(`\nFound ${mdFiles.length} posts to migrate\n`);

let ok = 0, failed = 0;

for (const mdFile of mdFiles) {
  const rawSlug = basename(mdFile, '.md');
  const slug = sanitizeSlug(rawSlug);

  try {
    const raw = readFileSync(join(LEGACY_DIR, mdFile), 'utf-8');
    const { fm, body } = parseFrontmatter(raw);

    const title = String(fm.title || rawSlug);
    const lang = hasFarsi(title) || hasFarsi(body.slice(0, 600)) ? 'fa' : 'en';
    const category = SLUG_CATEGORY[slug] ?? SLUG_CATEGORY[rawSlug] ?? DEFAULT_CATEGORY;
    const date = fm.date ? new Date(fm.date).toISOString().slice(0, 10) : '2016-01-01';
    const tags = Array.isArray(fm.tags) ? fm.tags.map(t => String(t)) : [];

    const convertedBody = convertHexoSyntax(body);
    const excerpt = extractExcerpt(body, lang);
    const rt = readingTime(convertedBody, lang);

    const hasCover = !!(fm.coverImage || fm.thumbnailImage);
    const thumbnailFile = fm.coverImage || fm.thumbnailImage || 'placeholder.jpg';

    // Create output directory
    const outDir = join(OUTPUT_DIR, slug);
    mkdirSync(outDir, { recursive: true });

    // Copy assets from legacy asset directory
    copyAssets(join(LEGACY_DIR, rawSlug), outDir);

    // Copy placeholder if no cover image
    if (!hasCover && existsSync(PLACEHOLDER_SRC)) {
      copyFileSync(PLACEHOLDER_SRC, join(outDir, 'placeholder.jpg'));
    }

    // Build frontmatter
    const fmOut = [
      '---',
      `title: ${JSON.stringify(title)}`,
      `excerpt: ${JSON.stringify(excerpt)}`,
      `date: ${date}`,
      `readingTime: ${rt}`,
      `category: "${category}"`,
      `tags: [${tags.map(t => JSON.stringify(t)).join(', ')}]`,
      `author: "amin"`,
      ...(lang === 'fa' ? [`lang: "fa"`] : []),
      `thumbnail: ./${thumbnailFile}`,
      '---',
    ].join('\n');

    writeFileSync(join(outDir, 'index.mdx'), fmOut + '\n\n' + convertedBody.trimStart(), 'utf-8');

    console.log(`  ✓  ${slug}  (${lang}, ${category}, ${rt} min)`);
    ok++;
  } catch (err) {
    console.error(`  ✗  ${rawSlug}: ${err.message}`);
    failed++;
  }
}

console.log(`\nDone: ${ok} migrated, ${failed} failed\n`);
