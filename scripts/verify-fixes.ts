import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import {
  getPresignedViewUrl, getPresignedUploadUrl,
  verifyObjectExists, deleteObject,
} from '../src/lib/storage';

const prisma = new PrismaClient();
const ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? 'https://trizen-photo-share.vercel.app';
let fail = 0;
const check = (ok: boolean, msg: string) => { console.log(`${ok ? 'PASS' : 'FAIL'}: ${msg}`); if (!ok) fail++; };

async function main() {
  // ---- Bug #1: seeded images are real & visible ----
  const gallery = await prisma.gallery.findUnique({
    where: { slug: 'arjun-priya-wedding' },
    include: { photos: { include: { photo: true }, orderBy: { order: 'asc' } } },
  });
  const photos = gallery!.photos.map((gp) => gp.photo);
  check(photos.length === 3, `gallery has 3 published photos (got ${photos.length})`);
  check(photos.every((p) => p.fileSize > 2000), `all fileSize > 2KB (${photos.map((p) => p.fileSize).join(',')})`);

  const url = await getPresignedViewUrl(photos[0].storageKey);
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  const meta = await sharp(buf).metadata();
  check(res.ok && meta.width === 1200 && meta.height === 800, `photo[0] fetched, ${meta.width}x${meta.height} ${meta.format}, ${buf.length}B`);

  // ---- Bug #2: browser-style cross-origin upload works (preflight + PUT) ----
  const key = 'events/verify-fixes/browser-upload.jpg';
  const { uploadUrl, method } = await getPresignedUploadUrl(key, 'image/jpeg');

  const pre = await fetch(uploadUrl, {
    method: 'OPTIONS',
    headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'content-type' },
  });
  check(pre.status === 200 && pre.headers.get('access-control-allow-origin') === ORIGIN,
    `preflight ${pre.status}, allow-origin=${pre.headers.get('access-control-allow-origin')}`);

  const body = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#345' } }).jpeg().toBuffer();
  const put = await fetch(uploadUrl, { method, headers: { Origin: ORIGIN, 'Content-Type': 'image/jpeg' }, body });
  check(put.ok, `cross-origin PUT ${put.status}, allow-origin=${put.headers.get('access-control-allow-origin')}`);
  check(await verifyObjectExists(key), 'uploaded object exists (HEAD)');
  await deleteObject(key);

  console.log(fail === 0 ? '\nALL FIXES VERIFIED: PASS' : `\n${fail} CHECK(S) FAILED`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
