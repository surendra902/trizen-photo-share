import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { z } from 'zod';

const createEventSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Role-based filtering (PDF Requirement & Security Scenario #1)
    let events;
    if (user.role === 'ADMIN') {
      events = await prisma.event.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          members: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
          gallery: {
            select: { id: true, slug: true, publishedAt: true },
          },
          _count: {
            select: { photos: true },
          },
        },
      });
    } else {
      // TEAM member only sees assigned events
      events = await prisma.event.findMany({
        where: {
          members: {
            some: { userId: user.id },
          },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          members: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
          gallery: {
            select: { id: true, slug: true, publishedAt: true },
          },
          _count: {
            select: { photos: true },
          },
        },
      });
    }

    return NextResponse.json({ events });
  } catch (err: unknown) {
    console.error('Events GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can create events' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = createEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { name, description } = parsed.data;
    const event = await prisma.event.create({
      data: {
        name,
        description: description || null,
        createdById: user.id,
      },
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (err: unknown) {
    console.error('Events POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
