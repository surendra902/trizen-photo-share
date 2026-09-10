import { NextRequest, NextResponse } from 'next/server';
import {
  saveLocalBuffer,
  readLocalFile,
  verifyLocalSignature,
  resolveLocalPath,
  DRIVER,
} from '@/lib/storage';

interface RouteParams {
  params: Promise<{ path: string[] }>;
}

/**
 * Local development stand-in for S3 presigned URLs.
 * - Only active when STORAGE_DRIVER === 'local' (404 otherwise, so this
 *   route exposes nothing in S3/R2 production deployments).
 * - Every request must carry a valid HMAC signature + unexpired timestamp,
 *   mirroring presigned URL semantics.
 * - Storage keys are resolved inside UPLOAD_DIR only; traversal is rejected.
 */
async function authorize(req: NextRequest, storageKey: string): Promise<NextResponse | null> {
  if (DRIVER !== 'local') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const expires = Number(req.nextUrl.searchParams.get('expires'));
  const sig = req.nextUrl.searchParams.get('sig') || '';
  if (!verifyLocalSignature(storageKey, expires, sig)) {
    return NextResponse.json({ error: 'Invalid or expired signature' }, { status: 403 });
  }

  if (resolveLocalPath(storageKey) === null) {
    return NextResponse.json({ error: 'Invalid storage key' }, { status: 400 });
  }

  return null;
}

export async function PUT(req: NextRequest, props: RouteParams) {
  try {
    const params = await props.params;
    const storageKey = decodeURIComponent(params.path.join('/'));

    const denied = await authorize(req, storageKey);
    if (denied) return denied;

    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await saveLocalBuffer(storageKey, buffer);

    return NextResponse.json({ success: true, storageKey });
  } catch (err: unknown) {
    console.error('Local storage upload error:', err);
    return NextResponse.json({ error: 'Failed to write file' }, { status: 500 });
  }
}

export async function GET(req: NextRequest, props: RouteParams) {
  try {
    const params = await props.params;
    const storageKey = decodeURIComponent(params.path.join('/'));

    const denied = await authorize(req, storageKey);
    if (denied) return denied;

    const buffer = await readLocalFile(storageKey);
    if (!buffer) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    let contentType = 'application/octet-stream';
    const lower = storageKey.toLowerCase();
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) contentType = 'image/jpeg';
    else if (lower.endsWith('.png')) contentType = 'image/png';
    else if (lower.endsWith('.webp')) contentType = 'image/webp';
    else if (lower.endsWith('.gif')) contentType = 'image/gif';

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (err: unknown) {
    console.error('Local storage read error:', err);
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 });
  }
}
