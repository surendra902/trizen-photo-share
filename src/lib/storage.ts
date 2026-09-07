import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const DRIVER = process.env.STORAGE_DRIVER || (process.env.S3_BUCKET ? 's3' : 'local');
const UPLOAD_DIR = path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.UPLOAD_DIR || 'uploads');

// Ensure local upload dir exists
if (DRIVER === 'local' && !fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

let s3Client: S3Client | null = null;
if (DRIVER === 's3') {
  s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: Boolean(process.env.S3_ENDPOINT), // true for MinIO/Cloudflare R2 if needed
  });
}

/**
 * Generates a unique storage key for an event photo
 */
export function generateStorageKey(eventId: string, filename: string): string {
  const ext = path.extname(filename).toLowerCase() || '.jpg';
  const randomStr = crypto.randomBytes(16).toString('hex');
  return `events/${eventId}/${randomStr}${ext}`;
}

/**
 * Generate a presigned PUT URL for client direct upload
 */
export async function getPresignedUploadUrl(
  storageKey: string,
  mimeType: string,
  expiresInSeconds: number = 900 // 15 minutes
): Promise<{ uploadUrl: string; method: string }> {
  if (DRIVER === 's3' && s3Client && process.env.S3_BUCKET) {
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: storageKey,
      ContentType: mimeType,
    });
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
    return { uploadUrl, method: 'PUT' };
  }

  // Local fallback: direct PUT to /api/local-storage/[...path]
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const uploadUrl = `${appUrl}/api/local-storage/${encodeURIComponent(storageKey)}`;
  return { uploadUrl, method: 'PUT' };
}

/**
 * Generate a presigned/secure GET URL for photo viewing
 */
export async function getPresignedViewUrl(
  storageKey: string,
  expiresInSeconds: number = 3600 // 1 hour
): Promise<string> {
  if (DRIVER === 's3' && s3Client && process.env.S3_BUCKET) {
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: storageKey,
    });
    return await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
  }

  // Local fallback
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${appUrl}/api/local-storage/${encodeURIComponent(storageKey)}`;
}

/**
 * Check if a file actually exists in storage (used to confirm upload)
 */
export async function verifyObjectExists(storageKey: string): Promise<boolean> {
  if (DRIVER === 's3' && s3Client && process.env.S3_BUCKET) {
    try {
      await s3Client.send(
        new HeadObjectCommand({
          Bucket: process.env.S3_BUCKET,
          Key: storageKey,
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  // Local filesystem
  const fullPath = path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, storageKey);
  return fs.existsSync(fullPath);
}

/**
 * Delete an object from storage
 */
export async function deleteObject(storageKey: string): Promise<void> {
  if (DRIVER === 's3' && s3Client && process.env.S3_BUCKET) {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: storageKey,
      })
    );
    return;
  }

  // Local filesystem
  const fullPath = path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, storageKey);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
}

/**
 * Save a buffer to local storage (used by local-storage route)
 */
export async function saveLocalBuffer(storageKey: string, buffer: Buffer): Promise<void> {
  const fullPath = path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, storageKey);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  await fs.promises.writeFile(fullPath, buffer);
}

/**
 * Read local buffer
 */
export async function readLocalFile(storageKey: string): Promise<Buffer | null> {
  const fullPath = path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, storageKey);
  if (!fs.existsSync(fullPath)) return null;
  return await fs.promises.readFile(fullPath);
}
