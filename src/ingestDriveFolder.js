import path from 'path';
import fs from 'fs';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import 'dotenv/config';

import { listAllFilesRecursive, downloadFile } from './services/googleDriveService.js';
import vectorService from './services/vectorService.js';

console.log('Ingest Google Drive Folder Service Loaded');

// -------------------------
// TEXT EXTRACTION
// -------------------------
async function extractText(filePath, mimeType) {
  console.log('Extracting:1111111111111', filePath, mimeType);

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
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/vnd.google-apps.document'
  ) {
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

  console.log('Folder ID:', folderId);
  console.log('🔄 Starting smart sync...');

  // Get all files from Google Drive
  const driveFiles = await listAllFilesRecursive(folderId);
  console.log(`Found ${driveFiles.length} files in Google Drive`);

  // Get all existing documents from vector DB
  const existingDocs = await vectorService.getAllDocuments();
  console.log(`Found ${existingDocs.count} documents in vector DB`);

  // Create map of existing documents by ID
  const existingDocsMap = new Map(
    existingDocs.documents.map(doc => [doc.id, doc.metadata])
  );

  // Track what needs to be updated/added/deleted
  const toAdd = [];
  const toUpdate = [];
  const existingIds = new Set();

  // Check each Drive file
  for (const file of driveFiles) {
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
    } else {
      console.log(`✓ Unchanged: ${file.name}`);
    }
  }

  // Find files to delete (in DB but not in Drive)
  const toDelete = [];
  for (const doc of existingDocs.documents) {
    if (!existingIds.has(doc.id)) {
      toDelete.push(doc.id);
      console.log(`🗑️  Deleted from Drive: ${doc.metadata.name}`);
    }
  }

  console.log(`\n📊 Summary: ${toAdd.length} new, ${toUpdate.length} updated, ${toDelete.length} deleted\n`);

  // Delete removed files from vector DB
  if (toDelete.length > 0) {
    await vectorService.deleteDocuments(toDelete);
    console.log(`Deleted ${toDelete.length} documents from vector DB`);
  }

  const tmpDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

  // Process new and updated files
  const filesToProcess = [...toAdd, ...toUpdate];

  if (filesToProcess.length === 0) {
    console.log('✅ Everything is up to date!');
    return;
  }

  // Delete old versions of updated files
  if (toUpdate.length > 0) {
    const updateIds = toUpdate.map(f => f.id);
    await vectorService.deleteDocuments(updateIds);
    console.log(`Removed ${toUpdate.length} old document versions`);
  }

  await Promise.all(
    filesToProcess.map(async (file) => {
      const ext = getExtension(file.mimeType, file.name);
      const destPath = path.join(tmpDir, `${file.id}${ext}`);

      await downloadFile(file.id, destPath, file.mimeType);

      if (!fs.existsSync(destPath)) {
        console.warn('Missing file:', destPath);
        return;
      }

      const text = await extractText(destPath, file.mimeType);
      console.log('Extracted text length:', text.length, file.folderPath);
      if (text?.trim()) {
        // Add folderPath to metadata (if available)
        await vectorService.addDocuments([
          {
            id: file.id,
            text,
            metadata: {
              name: file.name,
              mimeType: file.mimeType,
              folderPath: file.folderPath || '',
              modifiedTime: file.modifiedTime // Store modification time
            }
          }
        ]);
        console.log('Indexed:', file.name);
      } else {
        console.log('Skipped (empty):', file.name);
      }

      fs.unlinkSync(destPath);
    })
  );

  console.log(`\n✅ Smart sync complete! Processed ${filesToProcess.length} files`);
}

// RUN
ingestDriveFolder(process.env.GOOGLE_DRIVE_FOLDER_ID);

export default ingestDriveFolder;
