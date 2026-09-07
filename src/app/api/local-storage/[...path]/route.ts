import { NextRequest, NextResponse } from 'next/server';
import { saveLocalBuffer, readLocalFile } from '@/lib/storage';

interface RouteParams {
  params: Promise<{ path: string[] }>;
}

export async function PUT(req: NextRequest, props: RouteParams) {
  try {
    const params = await props.params;
    const rawKey = params.path.join('/');
    const storageKey = decodeURIComponent(rawKey);

    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await saveLocalBuffer(storageKey, buffer);

    return NextResponse.json({ success: true, storageKey });
  } catch (err: any) {
    console.error('Local storage upload error:', err);
    return NextResponse.json({ error: 'Failed to write file' }, { status: 500 });
  }
}

export async function GET(req: NextRequest, props: RouteParams) {
  try {
    const params = await props.params;
    const rawKey = params.path.join('/');
    const storageKey = decodeURIComponent(rawKey);

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
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err: any) {
    console.error('Local storage read error:', err);
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 });
  }
}
