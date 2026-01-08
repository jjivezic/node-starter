import path from 'path';
import fs from 'fs';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import 'dotenv/config';

import { listAllFilesRecursive, downloadFile } from './googleDriveService.js';
import { addMany, deleteMany, getAll } from './vectorService.js';

console.log('Ingest Google Drive Folder Service Loaded');

// -------------------------
// CACHE MANAGEMENT
// -------------------------
const CACHE_FILE = path.join(process.cwd(), 'tmp', '.drive-sync-cache.json');
const BATCH_SIZE = 50; // Process files in batches

function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    }
  } catch (err) {
    console.warn('Failed to load cache:', err.message);
  }
  return { lastSyncTime: null, fileCount: 0 };
}

function saveCache(data) {
  try {
    const tmpDir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.warn('Failed to save cache:', err.message);
  }
}

// -------------------------
// TEXT EXTRACTION
// -------------------------
async function extractText(filePath, mimeType) {
  // PDF
  if (mimeType === 'application/pdf') {
    try {
      const parser = new PDFParse({ url: filePath });
      const result = await parser.getText();
      return result.text;
    } catch (err) {
      console.error('PDF extract error:', err);
      return '';
    }
  }

  // DOCX (both MS Word and Google Docs exported as DOCX)
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || mimeType === 'application/vnd.google-apps.document') {
    try {
      console.log('Extracting DOCX...****************************');
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } catch (err) {
      console.error('DOCX extract error:', err);
      return '';
    }
  }

  // TEXT
  if (mimeType.startsWith('text/')) {
    return fs.readFileSync(filePath, 'utf8');
  }

  return '';
}

// -------------------------
// EXTENSION MAP
// -------------------------
function getExtension(mimeType, fileName) {
  const map = {
    'application/pdf': '.pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.google-apps.document': '.docx',
    'application/vnd.google-apps.spreadsheet': '.pdf',
    'application/vnd.google-apps.presentation': '.pdf',
    'text/plain': '.txt',
    'text/csv': '.csv',
    'text/html': '.html'
  };

  if (map[mimeType]) return map[mimeType];
  if (mimeType.startsWith('text/')) return '.txt';
  return path.extname(fileName) || '';
}

// -------------------------
// MAIN INGEST WITH SMART SYNC
// -------------------------
async function ingestDriveFolder(folderId) {
  const syncStartTime = new Date().toISOString();
  console.log('Folder ID:', folderId);
  console.log('🔄 Starting smart sync...');

  // Load cache
  const cache = loadCache();
  if (cache.lastSyncTime) {
    console.log(`📅 Last sync: ${cache.lastSyncTime} (${cache.fileCount} files)`);
  }

  // Get all files from Google Drive
  console.log('🔍 Fetching files from Google Drive...');
  const driveFiles = await listAllFilesRecursive(folderId);
  console.log(`Found ${driveFiles.length} files in Google Drive`);

  // Early exit if file count unchanged (quick optimization)
  if (cache.fileCount === driveFiles.length && cache.lastSyncTime) {
    console.log('💡 File count unchanged, checking for modifications...');
  }

  // Get all existing documents from vector DB
  console.log('🔍 Fetching documents from vector DB...');
  const existingDocs = await getAll();
  console.log(`Found ${existingDocs.count} documents in vector DB`);

  // Create map of existing documents by ID
  const existingDocsMap = new Map(existingDocs.documents.map((doc) => [doc.id, doc.metadata]));

  // Track what needs to be updated/added/deleted
  const toAdd = [];
  const toUpdate = [];
  const existingIds = new Set();

  // Check each Drive file with progress indicator
  console.log('🔄 Comparing files...');
  let checkedCount = 0;
  // eslint-disable-next-line no-restricted-syntax
  for (const file of driveFiles) {
    checkedCount += 1;
    if (checkedCount % 100 === 0 || checkedCount === driveFiles.length) {
      console.log(`  Progress: ${checkedCount}/${driveFiles.length} files checked`);
    }

    existingIds.add(file.id);
    const existing = existingDocsMap.get(file.id);

    if (!existing) {
      // New file
      toAdd.push(file);
      console.log(`➕ New file: ${file.name}`);
    } else if (existing.modifiedTime !== file.modifiedTime) {
      // File was modified
      toUpdate.push(file);
      console.log(`🔄 Updated file: ${file.name}`);
    }
    // Removed unchanged logging to reduce noise
  }

  // Find files to delete (in DB but not in Drive)
  const toDelete = [];
  // eslint-disable-next-line no-restricted-syntax
  for (const doc of existingDocs.documents) {
    if (!existingIds.has(doc.id)) {
      toDelete.push(doc.id);
      console.log(`🗑️  Deleted from Drive: ${doc.metadata.name}`);
    }
  }

  console.log(`\n📊 Summary: ${toAdd.length} new, ${toUpdate.length} updated, ${toDelete.length} deleted\n`);

  // Early exit if nothing changed
  if (toAdd.length === 0 && toUpdate.length === 0 && toDelete.length === 0) {
    console.log('✅ Everything is up to date! No changes detected.');
    // Update cache timestamp even if no changes
    saveCache({
      lastSyncTime: syncStartTime,
      fileCount: driveFiles.length
    });
    return;
  }

  // Delete removed files from vector DB
  if (toDelete.length > 0) {
    console.log(`🗑️  Deleting ${toDelete.length} documents from vector DB...`);
    await deleteMany(toDelete);
    console.log(`✅ Deleted ${toDelete.length} documents`);
  }

  const tmpDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  // Process new and updated files
  const filesToProcess = [...toAdd, ...toUpdate];

  // Delete old versions of updated files
  if (toUpdate.length > 0) {
    console.log(`🔄 Removing ${toUpdate.length} old document versions...`);
    const updateIds = toUpdate.map((f) => f.id);
    deleteMany(updateIds);
    console.log(`✅ Removed old versions`);
  }

  // Process files in batches for better performance and stability
  let processedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  console.log(`\n🚀 Processing ${filesToProcess.length} files in batches of ${BATCH_SIZE}...\n`);

  // eslint-disable-next-line no-restricted-syntax
  for (let i = 0; i < filesToProcess.length; i += BATCH_SIZE) {
    const batch = filesToProcess.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(filesToProcess.length / BATCH_SIZE);

    console.log(`📦 Batch ${batchNum}/${totalBatches} (${batch.length} files)`);

    // eslint-disable-next-line no-restricted-syntax
    for (const file of batch) {
      try {
        const ext = getExtension(file.mimeType, file.name);
        const destPath = path.join(tmpDir, `${file.id}${ext}`);

        await downloadFile(file.id, destPath, file.mimeType);

        if (!fs.existsSync(destPath)) {
          console.warn(`  ⚠️  Missing file after download: ${file.name}`);
          failedCount += 1;
          // eslint-disable-next-line no-continue
          continue;
        }

        const text = await extractText(destPath, file.mimeType);

        if (text?.trim()) {
          await addMany([
            {
              id: file.id,
              text,
              metadata: {
                name: file.name,
                mimeType: file.mimeType,
                folderPath: file.folderPath || '',
                modifiedTime: file.modifiedTime
              }
            }
          ]);
          console.log(`  ✅ Indexed: ${file.name} (${text.length} chars)`);
          processedCount += 1;
        } else {
          console.log(`  ⏭️  Skipped (empty): ${file.name}`);
          skippedCount += 1;
        }

        // Clean up temp file
        if (fs.existsSync(destPath)) {
          fs.unlinkSync(destPath);
        }
      } catch (error) {
        console.error(`  ❌ Failed to process ${file.name}: ${error.message}`);
        failedCount += 1;
      }
    }

    // Progress indicator
    const totalProcessed = processedCount + failedCount + skippedCount;
    console.log(
      `  Progress: ${totalProcessed}/${filesToProcess.length} (${processedCount} indexed, ${skippedCount} skipped, ${failedCount} failed)\n`
    );
  }

  // Save cache with updated timestamp
  saveCache({
    lastSyncTime: syncStartTime,
    fileCount: driveFiles.length
  });

  console.log(`\n✅ Smart sync complete!`);
  console.log(`   Processed: ${processedCount}/${filesToProcess.length}`);
  console.log(`   Skipped: ${skippedCount} (empty files)`);
  console.log(`   Failed: ${failedCount}`);
  console.log(`   Total Drive files: ${driveFiles.length}\n`);
}

// Only run directly if executed as a script (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  ingestDriveFolder(process.env.GOOGLE_DRIVE_FOLDER_ID);
}

export default ingestDriveFolder;
