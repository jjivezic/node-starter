import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import logger from '../config/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import { ERROR_CODES } from '../config/errorCodes.js';

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const BUCKET_NAME = process.env.S3_BUCKET;

/**
 * Upload a file to S3
 * @param {Object} file - File object from express-fileupload
 * @param {string} folder - Folder path in S3 bucket (default: 'uploads')
 * @returns {Promise<Object>} - Object containing key and url
 */
export const uploadToS3 = async (file, folder = 'uploads') => {
  try {
    const key = `${folder}/${Date.now()}-${file.name.replace(/\s+/g, '-')}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: file.data,
      ContentType: file.mimetype,
      ACL: 'public-read' // Remove if bucket has block public access
    });

    await s3Client.send(command);

    const url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;

    logger.info(`File uploaded to S3: ${key}`);

    return { key, url };
  } catch (error) {
    logger.error(`S3 upload error: ${error.message}`);
    throw new AppError('Failed to upload file to S3', 500, true, ERROR_CODES.INTERNAL_ERROR);
  }
};

/**
 * Upload a base64 encoded file to S3
 * @param {string} base64String - Base64 encoded file string (with or without data URI prefix)
 * @param {string} fileName - Name for the file
 * @param {string} contentType - MIME type (e.g., 'image/png', 'application/pdf')
 * @param {string} folder - Folder path in S3 bucket (default: 'uploads')
 * @returns {Promise<Object>} - Object containing key and url
 */
export const uploadBase64ToS3 = async (base64String, fileName, contentType, folder = 'uploads') => {
  try {
    // Remove data URI prefix if present (e.g., "data:image/png;base64,")
    const base64Data = base64String.includes(',') ? base64String.split(',')[1] : base64String;

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');

    // Generate unique file name
    const sanitizedFileName = fileName.replace(/\s+/g, '-');
    const key = `${folder}/${Date.now()}-${sanitizedFileName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ContentEncoding: 'base64',
      ACL: 'public-read' // Remove if bucket has block public access
    });

    await s3Client.send(command);

    const url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;

    logger.info(`Base64 file uploaded to S3: ${key}`);

    return { key, url };
  } catch (error) {
    logger.error(`S3 base64 upload error: ${error.message}`);
    throw new AppError('Failed to upload base64 file to S3', 500, true, ERROR_CODES.INTERNAL_ERROR);
  }
};

/**
 * Delete a file from S3
 * @param {string} key - S3 object key
 * @returns {Promise<void>}
 */
export const deleteFromS3 = async (key) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });

    await s3Client.send(command);

    logger.info(`File deleted from S3: ${key}`);
  } catch (error) {
    logger.error(`S3 delete error: ${error.message}`);
    throw new AppError('Failed to delete file from S3', 500, true, ERROR_CODES.INTERNAL_ERROR);
  }
};

/**
 * Generate a pre-signed URL for private file access
 * @param {string} key - S3 object key
 * @param {number} expiresIn - URL expiration time in seconds (default: 3600)
 * @returns {Promise<string>} - Pre-signed URL
 */
export const getPresignedUrl = async (key, expiresIn = 3600) => {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });

    return url;
  } catch (error) {
    logger.error(`S3 presigned URL error: ${error.message}`);
    throw new AppError('Failed to generate presigned URL', 500, true, ERROR_CODES.INTERNAL_ERROR);
  }
};

/**
 * Upload multiple files to S3
 * @param {Array} files - Array of file objects
 * @param {string} folder - Folder path in S3 bucket
 * @returns {Promise<Array>} - Array of upload results
 */
export const uploadMultipleToS3 = async (files, folder = 'uploads') => {
  try {
    const uploadPromises = files.map((file) => uploadToS3(file, folder));
    const results = await Promise.all(uploadPromises);

    return results;
  } catch (error) {
    logger.error(`S3 multiple upload error: ${error.message}`);
    throw new AppError('Failed to upload files to S3', 500, true, ERROR_CODES.INTERNAL_ERROR);
  }
};
