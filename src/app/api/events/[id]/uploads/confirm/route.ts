import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { verifyObjectExists } from '@/lib/storage';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const confirmSchema = z.object({
  photoId: z.string().min(1),
});

export async function POST(req: NextRequest, props: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: eventId } = await props.params;
    const body = await req.json();
    const parsed = confirmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'photoId is required' }, { status: 400 });
    }

    const { photoId } = parsed.data;

    const photo = await prisma.photo.findFirst({
      where: { id: photoId, eventId },
    });

    if (!photo) {
      return NextResponse.json({ error: 'Photo record not found' }, { status: 404 });
    }

    // Only the uploading user (or an admin) may confirm this photo.
    if (user.role !== 'ADMIN' && photo.uploadedById !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You can only confirm your own uploads' },
        { status: 403 }
      );
    }

    // Security Scenario #3: Verify object exists before updating metadata to UPLOADED
    const exists = await verifyObjectExists(photo.storageKey);
    if (!exists) {
      return NextResponse.json(
        {
          error: 'Upload verification failed: Image object not found in storage',
          status: 'PENDING',
        },
        { status: 400 }
      );
    }

    // Update status to UPLOADED
    const updated = await prisma.photo.update({
      where: { id: photoId },
      data: { status: 'UPLOADED' },
    });

    return NextResponse.json({ success: true, photo: updated });
  } catch (err: unknown) {
    console.error('Confirm upload error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
