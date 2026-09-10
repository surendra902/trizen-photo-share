import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, props: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await props.params;

    // Check event exists
    const event = await prisma.event.findUnique({
      where: { id },
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

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Security Scenario #1: Check user has access to this event
    if (user.role !== 'ADMIN') {
      const isMember = event.members.some((m) => m.userId === user.id);
      if (!isMember) {
        return NextResponse.json(
          { error: 'Forbidden: You are not assigned to this event' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({ event });
  } catch (err: unknown) {
    console.error('Event GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
