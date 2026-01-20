#!/usr/bin/env node

/**
 * Image Optimization Script
 * Converts images in public/images/posts to optimized WebP format
 *
 * Usage: node scripts/optimize-images.mjs [options]
 *
 * Options:
 *   --dry-run    Show what would be converted without making changes
 *   --quality    WebP quality (1-100, default: 85)
 *   --keep       Keep original files (default: false)
 */

import { readdir, stat, unlink, rename } from 'node:fs/promises';
import { join, extname, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const IMAGES_DIR = join(ROOT_DIR, 'public/images/posts');

const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.tiff', '.avif'];
const DEFAULT_QUALITY = 85;

async function loadSharp() {
  try {
    const sharp = (await import('sharp')).default;
    return sharp;
  } catch (error) {
    console.error('❌ sharp is not installed. Please run:');
    console.error('   pnpm add -D sharp');
    process.exit(1);
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run'),
    keep: args.includes('--keep'),
    quality: parseInt(args.find(a => a.startsWith('--quality='))?.split('=')[1] || DEFAULT_QUALITY, 10),
  };
}

async function findImages(dir) {
  const images = [];

  async function walk(currentDir) {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        if (SUPPORTED_EXTENSIONS.includes(ext)) {
          images.push(fullPath);
        }
      }
    }
  }

  await walk(dir);
  return images;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function convertImage(sharp, imagePath, quality, dryRun, keep) {
  const ext = extname(imagePath).toLowerCase();
  const webpPath = imagePath.replace(/\.[^.]+$/, '.webp');

  if (ext === '.webp') {
    return { status: 'skipped', reason: 'already webp' };
  }

  try {
    await stat(webpPath);
    return { status: 'skipped', reason: 'webp exists' };
  } catch {
  }

  const originalStats = await stat(imagePath);
  const originalSize = originalStats.size;

  if (dryRun) {
    return {
      status: 'would-convert',
      originalSize,
      from: imagePath,
      to: webpPath,
    };
  }

  try {
    await sharp(imagePath)
      .webp({ quality, effort: 6 })
      .toFile(webpPath);

    const newStats = await stat(webpPath);
    const newSize = newStats.size;
    const savings = ((originalSize - newSize) / originalSize * 100).toFixed(1);

    if (!keep) {
      await unlink(imagePath);
    }

    return {
      status: 'converted',
      originalSize,
      newSize,
      savings: `${savings}%`,
      from: imagePath,
      to: webpPath,
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message,
      from: imagePath,
    };
  }
}

async function main() {
  const args = parseArgs();
  const sharp = await loadSharp();

  console.log('🖼️  Image Optimization Script');
  console.log('━'.repeat(50));
  console.log(`📁 Directory: ${IMAGES_DIR}`);
  console.log(`📊 Quality: ${args.quality}`);
  console.log(`🔒 Keep originals: ${args.keep}`);
  if (args.dryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made');
  }
  console.log('━'.repeat(50));

  try {
    const images = await findImages(IMAGES_DIR);
    console.log(`Found ${images.length} image(s) to process\n`);

    if (images.length === 0) {
      console.log('No images found to convert.');
      return;
    }

    let totalOriginal = 0;
    let totalNew = 0;
    let converted = 0;
    let skipped = 0;
    let errors = 0;

    for (const imagePath of images) {
      const relativePath = imagePath.replace(IMAGES_DIR + '/', '');
      const result = await convertImage(sharp, imagePath, args.quality, args.dryRun, args.keep);

      switch (result.status) {
        case 'converted':
          console.log(`✅ ${relativePath}`);
          console.log(`   ${formatBytes(result.originalSize)} → ${formatBytes(result.newSize)} (${result.savings} saved)`);
          totalOriginal += result.originalSize;
          totalNew += result.newSize;
          converted++;
          break;

        case 'would-convert':
          console.log(`📝 Would convert: ${relativePath}`);
          console.log(`   Size: ${formatBytes(result.originalSize)}`);
          totalOriginal += result.originalSize;
          converted++;
          break;

        case 'skipped':
          console.log(`⏭️  Skipped: ${relativePath} (${result.reason})`);
          skipped++;
          break;

        case 'error':
          console.log(`❌ Error: ${relativePath}`);
          console.log(`   ${result.error}`);
          errors++;
          break;
      }
    }

    console.log('\n' + '━'.repeat(50));
    console.log('📊 Summary:');
    console.log(`   Converted: ${converted}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Errors: ${errors}`);

    if (!args.dryRun && converted > 0) {
      const totalSavings = ((totalOriginal - totalNew) / totalOriginal * 100).toFixed(1);
      console.log(`   Total size: ${formatBytes(totalOriginal)} → ${formatBytes(totalNew)} (${totalSavings}% saved)`);
    } else if (args.dryRun && converted > 0) {
      console.log(`   Total original size: ${formatBytes(totalOriginal)}`);
    }

    console.log('━'.repeat(50));

    if (!args.dryRun && converted > 0) {
      console.log('\n⚠️  Remember to update image references in your content files!');
      console.log('   Change: .jpg/.png → .webp');
    }

  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

main();
