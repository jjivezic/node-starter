import 'dotenv/config';
import { google } from 'googleapis';
// import logger from '../config/logger.js';

/**
 * Google Drive Service
 * - Authenticates with OAuth2
 * - Lists and downloads files from a folder
 */
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_DRIVE_PRIVATE_KEY
  },
  scopes: ['https://www.googleapis.com/auth/drive']
});

const drive = google.drive({ version: 'v3', auth });

export async function listFilesInFolder(folderId) {
  console.log('folderId in service:', folderId);
  const filesListResult = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, modifiedTime, parents)',
    pageSize: 1000
  });
  console.log('Files retrieved:', filesListResult.data.files);
  return filesListResult.data.files;
}
export async function listAllFilesRecursive(folderId) {
  console.log('🔍 Fetching all files from Drive (optimized)...');
  
  const allFiles = [];
  const folderQueue = [{ id: folderId, path: '' }];
  const processedFolders = new Set();
  let apiCallCount = 0;

  // Process folders iteratively (not recursively) to avoid deep call stacks
  while (folderQueue.length > 0) {
    const { id: currentFolderId, path: currentPath } = folderQueue.shift();
    
    // Skip if already processed (prevent duplicates)
    // eslint-disable-next-line no-continue
    if (processedFolders.has(currentFolderId)) continue;
    processedFolders.add(currentFolderId);

    apiCallCount += 1;
    const response = await drive.files.list({
      q: `'${currentFolderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, parents, modifiedTime)',
      pageSize: 1000
    });

    const items = response.data.files || [];
    
    for (const item of items) {
      if (item.mimeType === 'application/vnd.google-apps.folder') {
        // It's a folder - add to queue for processing
        const subfolderPath = currentPath ? `${currentPath}/${item.name}` : item.name;
        folderQueue.push({ id: item.id, path: subfolderPath });
      } else {
        // It's a file - add with folder path
        allFiles.push({
          ...item,
          folderPath: currentPath
        });
      }
    }
  }

  console.log(`📊 Retrieved ${allFiles.length} files in ${apiCallCount} API call(s)`);
  
  return allFiles;
}
export async function downloadFile(fileId, destPath, mimeType) {
  const { createWriteStream } = await import('fs');
  const dest = createWriteStream(destPath);

  // Google Docs mimeTypes
  const googleDocsMimeTypes = {
    'application/vnd.google-apps.document': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
    'application/vnd.google-apps.spreadsheet': 'application/pdf', // PDF for Sheets
    'application/vnd.google-apps.presentation': 'application/pdf' // PDF for Slides
  };
  console.log('googleDocsMimeTypes[mimeType]', googleDocsMimeTypes[mimeType]);
  if (googleDocsMimeTypes[mimeType]) {
    // Export Google Docs as DOCX or PDF
    console.log('Exporting Google Doc...');
    const exportMimeType = googleDocsMimeTypes[mimeType];
    await drive.files.export({ fileId, mimeType: exportMimeType }, { responseType: 'stream' }).then(
      (res) =>
        new Promise((resolve, reject) => {
          res.data
            .on('end', () => resolve(destPath))
            .on('error', (err) => reject(err))
            .pipe(dest);
        })
    );
  } else {
    // Download regular files (PDF, DOCX, etc.)
    console.log('Downloading regular file...');
    await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' }).then(
      (res) =>
        new Promise((resolve, reject) => {
          res.data
            .on('end', () => resolve(destPath))
            .on('error', (err) => reject(err))
            .pipe(dest);
        })
    );
  }
  return destPath;
}
