import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyGalleryToken, GALLERY_COOKIE_PREFIX } from '@/lib/auth';
import { getPresignedViewUrl } from '@/lib/storage';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(req: NextRequest, props: RouteParams) {
  try {
    const { slug } = await props.params;

    // Check signed gallery cookie
    const cookieName = `${GALLERY_COOKIE_PREFIX}${slug}`;
    const token = req.cookies.get(cookieName)?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'PIN verification required', authenticated: false },
        { status: 401 }
      );
    }

    const isValidToken = await verifyGalleryToken(token, slug);
    if (!isValidToken) {
      return NextResponse.json(
        { error: 'Session expired or invalid PIN', authenticated: false },
        { status: 401 }
      );
    }

    // Security Scenario #5: Query ONLY photos published to this gallery
    const gallery = await prisma.gallery.findUnique({
      where: { slug },
      include: {
        event: {
          select: {
            name: true,
            description: true,
          },
        },
        photos: {
          orderBy: { order: 'asc' },
          include: {
            photo: {
              select: {
                id: true,
                filename: true,
                storageKey: true,
                fileSize: true,
                mimeType: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!gallery) {
      return NextResponse.json({ error: 'Gallery not found' }, { status: 404 });
    }

    // Attach presigned view URLs to published photos only
    const photosWithUrls = await Promise.all(
      gallery.photos.map(async (item) => {
        const p = item.photo;
        const viewUrl = await getPresignedViewUrl(p.storageKey, 3600); // 1 hour TTL
        return {
          id: p.id,
          filename: p.filename,
          fileSize: p.fileSize,
          mimeType: p.mimeType,
          createdAt: p.createdAt,
          order: item.order,
          viewUrl,
        };
      })
    );

    return NextResponse.json({
      authenticated: true,
      event: {
        name: gallery.event.name,
        description: gallery.event.description,
      },
      publishedAt: gallery.publishedAt,
      totalPhotos: photosWithUrls.length,
      photos: photosWithUrls,
    });
  } catch (err: any) {
    console.error('Gallery photos GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
