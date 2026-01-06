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

// const drive = google.drive({ version: "v3", auth });
// const driveListResult = await drive.files.list({ pageSize: 1 });

// console.log('xxxxxxxxxxx', driveListResult.data);
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
export async function listAllFilesRecursive(folderId, currentPath = '') {
  const filesListResult = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, parents, modifiedTime)',
    pageSize: 1000
  });
  const files = filesListResult.data.files || [];
  const results = await Promise.all(
    files.map(async (file) => {
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        // It's a folder, recurse
        const subfolderPath = currentPath ? `${currentPath}/${file.name}` : file.name;
        console.log('Recursing into folder:', subfolderPath);
        return listAllFilesRecursive(file.id, subfolderPath);
      }
      // It's a file, add with full path
      console.log('Found file:', currentPath);
      return [
        {
          ...file,
          folderPath: currentPath
        }
      ];
    })
  );
  return results.flat();
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
