// One-shot round-trip check against the configured S3-compatible provider.
// Usage: npx tsx --env-file=.env scripts/verify-storage.ts
import {
  putObject,
  verifyObjectExists,
  getPresignedViewUrl,
  deleteObject,
} from '../src/lib/storage';

const KEY = 'smoke-test/filebase-roundtrip.txt';

async function main() {
  const body = Buffer.from(`roundtrip ${new Date().toISOString()}`);

  await putObject(KEY, body, 'text/plain');
  console.log('1. PUT ok');

  const exists = await verifyObjectExists(KEY);
  if (!exists) throw new Error('HEAD says object missing');
  console.log('2. HEAD ok');

  const url = await getPresignedViewUrl(KEY);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`presigned GET failed: ${res.status}`);
  const text = await res.text();
  if (text !== body.toString()) throw new Error('GET body mismatch');
  console.log('3. presigned GET ok (body matches)');

  await deleteObject(KEY);
  const gone = await verifyObjectExists(KEY);
  if (gone) throw new Error('object still present after DELETE');
  console.log('4. DELETE ok');

  console.log('STORAGE ROUND-TRIP: PASS');
  process.exit(0);
}

main().catch((err) => {
  console.error('STORAGE ROUND-TRIP: FAIL —', err);
  process.exit(1);
});
