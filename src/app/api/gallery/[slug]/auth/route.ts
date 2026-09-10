import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyPin, createGalleryToken, GALLERY_COOKIE_PREFIX } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

const pinSchema = z.object({
  pin: z.string().min(1, 'PIN is required'),
});

export async function POST(req: NextRequest, props: RouteParams) {
  try {
    const { slug } = await props.params;
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';

    // Security Scenario #4: Rate limiting per IP and slug
    const rateLimit = checkRateLimit(`gallery-pin:${ip}:${slug}`, 10, 15 * 60);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Too many failed attempts. Access locked for ${Math.ceil(rateLimit.resetSeconds / 60)} minutes.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = pinSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'PIN is required' }, { status: 400 });
    }

    const { pin } = parsed.data;

    // Look up gallery
    const gallery = await prisma.gallery.findUnique({
      where: { slug },
    });

    // Generic error response to leak nothing about slug existence vs wrong PIN
    if (!gallery) {
      return NextResponse.json({ error: 'Invalid PIN or gallery unavailable' }, { status: 401 });
    }

    const isValid = await verifyPin(pin, gallery.pinHash);
    if (!isValid) {
      return NextResponse.json(
        {
          error: 'Invalid PIN. Please check and try again.',
          remainingAttempts: rateLimit.remaining,
        },
        { status: 401 }
      );
    }

    // PIN is valid: create signed gallery token
    const token = await createGalleryToken(slug);
    const cookieName = `${GALLERY_COOKIE_PREFIX}${slug}`;

    const response = NextResponse.json({ success: true, slug }, { status: 200 });

    response.cookies.set({
      name: cookieName,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (err: unknown) {
    console.error('Gallery PIN auth error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
