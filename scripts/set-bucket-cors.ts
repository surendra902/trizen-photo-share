// Apply the bucket CORS policy the browser upload path needs.
//
// The dashboard uploads files with a direct cross-origin PUT from the app
// origin to the S3 endpoint (s3.filebase.com). Without a bucket CORS policy
// the browser's preflight (OPTIONS) is rejected and the PUT never fires.
// This is a bucket-side setting, so it must be (re)applied whenever the
// bucket is created. Run once after creating the bucket:
//
//   npx tsx --env-file=.env scripts/set-bucket-cors.ts
import {
  S3Client,
  PutBucketCorsCommand,
  GetBucketCorsCommand,
} from '@aws-sdk/client-s3';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://trizen-photo-share.vercel.app';
const ALLOWED_ORIGINS = [APP_URL, 'http://localhost:3000'];

async function main() {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error('S3_BUCKET not set');

  const client = new S3Client({
    region: process.env.AWS_REGION,
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: ALLOWED_ORIGINS,
            AllowedMethods: ['PUT', 'GET', 'HEAD'],
            AllowedHeaders: ['*'],
            ExposeHeaders: ['ETag'],
            MaxAgeSeconds: 3000,
          },
        ],
      },
    })
  );
  console.log(`PutBucketCors ok for "${bucket}" — origins: ${ALLOWED_ORIGINS.join(', ')}`);

  const check = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
  console.log('Live policy:', JSON.stringify(check.CORSRules));
  console.log('CORS SET: PASS');
}

main().catch((err) => {
  console.error('CORS SET: FAIL —', err);
  process.exit(1);
});
