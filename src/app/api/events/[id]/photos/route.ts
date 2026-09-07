import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getPresignedViewUrl, deleteObject } from '@/lib/storage';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, props: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: eventId } = await props.params;

    // Check event exists & access rights (Scenario #1)
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        members: true,
      },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (user.role !== 'ADMIN') {
      const isMember = event.members.some((m) => m.userId === user.id);
      if (!isMember) {
        return NextResponse.json(
          { error: 'Forbidden: You do not have access to this event' },
          { status: 403 }
        );
      }
    }

    // Role-based photo query:
    // ADMIN sees all uploaded photos; TEAM sees only their own uploaded photos
    const photoWhere: any = {
      eventId,
      status: 'UPLOADED',
    };

    if (user.role !== 'ADMIN') {
      photoWhere.uploadedById = user.id;
    }

    const photos = await prisma.photo.findMany({
      where: photoWhere,
      orderBy: { createdAt: 'desc' },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
        galleryMemberships: { select: { galleryId: true, order: true } },
      },
    });

    // Attach presigned view URLs
    const photosWithUrls = await Promise.all(
      photos.map(async (p) => {
        const viewUrl = await getPresignedViewUrl(p.storageKey);
        return {
          id: p.id,
          eventId: p.eventId,
          filename: p.filename,
          mimeType: p.mimeType,
          fileSize: p.fileSize,
          storageKey: p.storageKey,
          createdAt: p.createdAt,
          uploadedBy: p.uploadedBy,
          viewUrl,
          isPublished: p.galleryMemberships.length > 0,
        };
      })
    );

    return NextResponse.json({ photos: photosWithUrls });
  } catch (err: any) {
    console.error('Photos GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, props: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can delete photos' }, { status: 403 });
    }

    const { id: eventId } = await props.params;
    const { searchParams } = new URL(req.url);
    const photoId = searchParams.get('photoId');

    if (!photoId) {
      return NextResponse.json({ error: 'photoId query param is required' }, { status: 400 });
    }

    const photo = await prisma.photo.findFirst({
      where: { id: photoId, eventId },
    });

    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    // Delete from storage
    await deleteObject(photo.storageKey);

    // Delete from DB
    await prisma.photo.delete({ where: { id: photoId } });

    return NextResponse.json({ success: true, deletedPhotoId: photoId });
  } catch (err: any) {
    console.error('Photos DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
