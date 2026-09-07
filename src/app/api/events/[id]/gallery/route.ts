import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser, hashPin } from '@/lib/auth';
import crypto from 'crypto';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const publishGallerySchema = z.object({
  photoIds: z.array(z.string()).min(1, 'Select at least one photo to publish'),
  pin: z
    .string()
    .regex(/^\d{4,8}$/, 'PIN must be between 4 and 8 digits')
    .optional(),
});

export async function POST(req: NextRequest, props: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Security Scenario #2: Team member attempting to publish a gallery
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can publish galleries' },
        { status: 403 }
      );
    }

    const { id: eventId } = await props.params;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { gallery: true },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const body = await req.json();
    const parsed = publishGallerySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { photoIds, pin: providedPin } = parsed.data;

    // Verify all photoIds belong to this event and are UPLOADED
    const validPhotos = await prisma.photo.findMany({
      where: {
        id: { in: photoIds },
        eventId,
        status: 'UPLOADED',
      },
      select: { id: true },
    });

    if (validPhotos.length !== photoIds.length) {
      return NextResponse.json(
        { error: 'One or more selected photos do not belong to this event or are pending upload' },
        { status: 400 }
      );
    }

    // Generate PIN if not provided: 6-digit
    const rawPin = providedPin || Math.floor(100000 + Math.random() * 900000).toString();
    const pinHash = await hashPin(rawPin);

    // Slug: slugify event name + 6 char random hex
    const slugBase = event.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    const randomSuffix = crypto.randomBytes(3).toString('hex');
    const slug = event.gallery?.slug || `${slugBase}-${randomSuffix}`;

    // Transaction: update or create gallery & update gallery photos
    const result = await prisma.$transaction(async (tx) => {
      // Upsert gallery
      const gallery = await tx.gallery.upsert({
        where: { eventId },
        create: {
          eventId,
          slug,
          pinHash,
          publishedAt: new Date(),
        },
        update: {
          pinHash,
          publishedAt: new Date(),
        },
      });

      // Clear previous memberships for republishing
      await tx.galleryPhoto.deleteMany({
        where: { galleryId: gallery.id },
      });

      // Insert new memberships
      const photoMemberships = photoIds.map((photoId, idx) => ({
        galleryId: gallery.id,
        photoId,
        order: idx,
      }));

      await tx.galleryPhoto.createMany({
        data: photoMemberships,
      });

      return { gallery, photoCount: photoMemberships.length };
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const galleryUrl = `${appUrl}/gallery/${result.gallery.slug}`;

    return NextResponse.json(
      {
        success: true,
        slug: result.gallery.slug,
        pin: rawPin, // Returned once so admin can copy and distribute
        galleryUrl,
        publishedAt: result.gallery.publishedAt,
        photoCount: result.photoCount,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('Gallery publish error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest, props: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: eventId } = await props.params;

    const gallery = await prisma.gallery.findUnique({
      where: { eventId },
      include: {
        _count: { select: { photos: true } },
      },
    });

    if (!gallery) {
      return NextResponse.json({ published: false, gallery: null });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return NextResponse.json({
      published: true,
      gallery: {
        id: gallery.id,
        slug: gallery.slug,
        galleryUrl: `${appUrl}/gallery/${gallery.slug}`,
        publishedAt: gallery.publishedAt,
        photoCount: gallery._count.photos,
      },
    });
  } catch (err: any) {
    console.error('Gallery GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
