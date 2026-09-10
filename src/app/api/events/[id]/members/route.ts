import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const addMemberSchema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest, props: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can add team members' }, { status: 403 });
    }

    const { id: eventId } = await props.params;

    // Check event exists
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const body = await req.json();
    const parsed = addMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'No user registered with this email' },
        { status: 404 }
      );
    }

    // Add to event if not already member
    const existingMember = await prisma.eventMember.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId: targetUser.id,
        },
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { message: 'User is already a member of this event' },
        { status: 200 }
      );
    }

    await prisma.eventMember.create({
      data: {
        eventId,
        userId: targetUser.id,
      },
    });

    return NextResponse.json(
      {
        success: true,
        member: { id: targetUser.id, name: targetUser.name, email: targetUser.email },
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error('Add member error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
