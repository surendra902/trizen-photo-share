import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { generateStorageKey, getPresignedUploadUrl } from '@/lib/storage';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const presignSchema = z.object({
  files: z
    .array(
      z.object({
        filename: z.string().min(1),
        mimeType: z.string().min(1),
        fileSize: z.number().int().positive(),
      })
    )
    .min(1),
});

export async function POST(req: NextRequest, props: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: eventId } = await props.params;

    // Check event exists & user is authorized (Scenario #1)
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { members: true },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (user.role !== 'ADMIN') {
      const isMember = event.members.some((m) => m.userId === user.id);
      if (!isMember) {
        return NextResponse.json(
          { error: 'Forbidden: You cannot upload to an unassigned event' },
          { status: 403 }
        );
      }
    }

    const body = await req.json();
    const parsed = presignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid files payload', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const uploads = [];

    // Create PENDING records and generate presigned URLs
    for (const file of parsed.data.files) {
      const storageKey = generateStorageKey(eventId, file.filename);
      const { uploadUrl, method } = await getPresignedUploadUrl(storageKey, file.mimeType);

      const photo = await prisma.photo.create({
        data: {
          eventId,
          uploadedById: user.id,
          filename: file.filename,
          storageKey,
          mimeType: file.mimeType,
          fileSize: file.fileSize,
          status: 'PENDING',
        },
      });

      uploads.push({
        photoId: photo.id,
        storageKey,
        uploadUrl,
        method,
        filename: file.filename,
      });
    }

    return NextResponse.json({ uploads }, { status: 201 });
  } catch (err: any) {
    console.error('Presign upload error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
