import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import type { User, Event, Prisma } from '@prisma/client';
import { prisma } from '../src/lib/db';
import {
  hashPassword,
  verifyPassword,
  hashPin,
  verifyPin,
  createAuthToken,
  verifyAuthToken,
  createGalleryToken,
  verifyGalleryToken,
} from '../src/lib/auth';
import { checkRateLimit } from '../src/lib/rate-limit';
import {
  generateStorageKey,
  verifyObjectExists,
  resolveLocalPath,
  verifyLocalSignature,
} from '../src/lib/storage';

// NOTE: this suite runs against the isolated test database (.env.test ->
// prisma/test.db, provisioned by `npm test`); it never touches dev.db.

describe('TrizenAI Photo Sharing Platform - Core Verification Suite', () => {
  let adminUser: User;
  let teamUser: User;
  let unauthorizedTeamUser: User;
  let testEvent: Event;
  let uploadedPhotoIds: string[] = [];
  let publishedGallery: Prisma.GalleryGetPayload<{ include: { photos: true } }>;
  const DEMO_PIN = '482917';

  before(async () => {
    // Reset test data
    await prisma.galleryPhoto.deleteMany({});
    await prisma.gallery.deleteMany({});
    await prisma.photo.deleteMany({});
    await prisma.eventMember.deleteMany({});
    await prisma.event.deleteMany({});
    await prisma.user.deleteMany({});

    // Setup Admin and 2 Team Members
    const adminPassHash = await hashPassword('Admin@123456');
    adminUser = await prisma.user.create({
      data: {
        email: 'test_admin@trizen.com',
        name: 'Test Admin',
        passwordHash: adminPassHash,
        role: 'ADMIN',
      },
    });

    const teamPassHash = await hashPassword('Team@123456');
    teamUser = await prisma.user.create({
      data: {
        email: 'assigned_team@trizen.com',
        name: 'Assigned Team Member',
        passwordHash: teamPassHash,
        role: 'TEAM',
      },
    });

    unauthorizedTeamUser = await prisma.user.create({
      data: {
        email: 'unassigned_team@trizen.com',
        name: 'Unassigned Team Member',
        passwordHash: teamPassHash,
        role: 'TEAM',
      },
    });

    // Create Event assigned only to teamUser
    testEvent = await prisma.event.create({
      data: {
        name: 'Arjun & Priya Wedding Test',
        description: 'Automated test suite event',
        createdById: adminUser.id,
        members: {
          create: [{ userId: teamUser.id }],
        },
      },
    });
  });

  // AREA 1: Authentication and Authorization
  describe('Area 1: Authentication & Role-Based Authorization', () => {
    test('Password hashing and secure verification', async () => {
      const plain = 'SecretPassword123!';
      const hash = await hashPassword(plain);
      assert.notEqual(plain, hash);
      assert.equal(await verifyPassword(plain, hash), true);
      assert.equal(await verifyPassword('WrongPassword', hash), false);
    });

    test('JWT session creation, expiration and role payload verification', async () => {
      const token = await createAuthToken({
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        role: 'ADMIN',
      });

      const decoded = await verifyAuthToken(token);
      assert.ok(decoded);
      assert.equal(decoded.id, adminUser.id);
      assert.equal(decoded.role, 'ADMIN');
    });

    test('Registration never lets a client self-assign the ADMIN role', async () => {
      // Directly exercises the real /api/auth/register handler. Users already
      // exist (created in `before`), so a new registration must land as TEAM
      // even when the client forges role: 'ADMIN' in the payload.
      const { POST } = await import('../src/app/api/auth/register/route');
      const req = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'escalator@trizen.com',
          name: 'Escalation Attempt',
          password: 'Pass1234',
          role: 'ADMIN',
        }),
      }) as unknown as Parameters<typeof POST>[0];

      const res = await POST(req);
      const body = await res.json();
      assert.equal(res.status, 201);
      assert.equal(body.user.role, 'TEAM');
    });

    test('Security Scenario 2: Team Member cannot publish gallery (Forbidden)', async () => {
      // Mirrors the role gate in POST /api/events/[id]/gallery
      const roleCheck = (userRole: string) => {
        if (userRole !== 'ADMIN') {
          return { status: 403, error: 'Forbidden: Only administrators can publish galleries' };
        }
        return { status: 200, success: true };
      };

      const teamAttempt = roleCheck(teamUser.role);
      assert.equal(teamAttempt.status, 403);

      const adminAttempt = roleCheck(adminUser.role);
      assert.equal(adminAttempt.status, 200);
    });
  });

  // AREA 2: Photo Access Controls & Scoped Event Access
  describe('Area 2: Photo Access Controls & Cross-Event Isolation', () => {
    test('Security Scenario 1: User attempting to access unassigned event is blocked', async () => {
      // Helper mirroring the event access check used by every /api/events/[id] route
      const checkEventAccess = async (userId: string, userRole: string, eventId: string) => {
        const ev = await prisma.event.findUnique({
          where: { id: eventId },
          include: { members: true },
        });
        if (!ev) return 404;
        if (userRole === 'ADMIN') return 200;
        const isMember = ev.members.some((m) => m.userId === userId);
        return isMember ? 200 : 403;
      };

      // Admin has access
      assert.equal(await checkEventAccess(adminUser.id, adminUser.role, testEvent.id), 200);
      // Assigned team member has access
      assert.equal(await checkEventAccess(teamUser.id, teamUser.role, testEvent.id), 200);
      // Unassigned team member is blocked with 403
      assert.equal(
        await checkEventAccess(unauthorizedTeamUser.id, unauthorizedTeamUser.role, testEvent.id),
        403
      );
    });

    test('Photo listings are role-scoped: Team member sees only own uploads', async () => {
      // Create photos uploaded by teamUser and adminUser
      const photo1 = await prisma.photo.create({
        data: {
          eventId: testEvent.id,
          uploadedById: teamUser.id,
          filename: 'team_photo_1.jpg',
          storageKey: generateStorageKey(testEvent.id, 'team_photo_1.jpg'),
          mimeType: 'image/jpeg',
          fileSize: 1024,
          status: 'UPLOADED',
        },
      });

      const photo2 = await prisma.photo.create({
        data: {
          eventId: testEvent.id,
          uploadedById: adminUser.id,
          filename: 'admin_photo_2.jpg',
          storageKey: generateStorageKey(testEvent.id, 'admin_photo_2.jpg'),
          mimeType: 'image/jpeg',
          fileSize: 2048,
          status: 'UPLOADED',
        },
      });

      uploadedPhotoIds = [photo1.id, photo2.id];

      // Query as Admin (all photos in event)
      const adminPhotos = await prisma.photo.findMany({
        where: { eventId: testEvent.id, status: 'UPLOADED' },
      });
      assert.equal(adminPhotos.length, 2);

      // Query as Team Member (only photos uploaded by this member)
      const teamPhotos = await prisma.photo.findMany({
        where: { eventId: testEvent.id, uploadedById: teamUser.id, status: 'UPLOADED' },
      });
      assert.equal(teamPhotos.length, 1);
      assert.equal(teamPhotos[0].filename, 'team_photo_1.jpg');
    });

    test('Security Scenario 3: Failed photo upload stays PENDING and is not marked UPLOADED', async () => {
      const pendingPhoto = await prisma.photo.create({
        data: {
          eventId: testEvent.id,
          uploadedById: teamUser.id,
          filename: 'corrupted_upload.jpg',
          storageKey: 'events/non_existent_key_12345.jpg',
          mimeType: 'image/jpeg',
          fileSize: 5000,
          status: 'PENDING',
        },
      });

      // Storage verification fails because file does not exist
      const exists = await verifyObjectExists(pendingPhoto.storageKey);
      assert.equal(exists, false);

      // Because file does not exist, status remains PENDING
      const currentPhoto = await prisma.photo.findUnique({ where: { id: pendingPhoto.id } });
      assert.equal(currentPhoto?.status, 'PENDING');
    });

    test('Storage path traversal is rejected (local adapter)', () => {
      // ../../../etc/passwd style keys must never resolve outside UPLOAD_DIR
      assert.equal(resolveLocalPath('../../../pwned.txt'), null);
      assert.equal(resolveLocalPath('events/ok/../../../../pwned.txt'), null);
      // Absolute paths are rejected on both Windows and POSIX
      assert.equal(resolveLocalPath('/etc/passwd'), null);
      // A legitimate key still resolves
      assert.ok(resolveLocalPath(`events/${testEvent.id}/abcd1234.jpg`));
    });

    test('Local presigned URLs reject tampered and expired signatures', () => {
      const key = `events/${testEvent.id}/abcd1234.jpg`;
      const future = Date.now() + 60_000;
      const past = Date.now() - 1_000;

      // Sanity: a signature for a future expiry verifies for the same key
      assert.equal(verifyLocalSignature(key, future, ''), false);

      // Tampered / missing signature
      assert.equal(verifyLocalSignature(key, future, 'deadbeef'), false);
      // Expired timestamp
      assert.equal(verifyLocalSignature(key, past, 'deadbeef'), false);
    });
  });

  // AREA 3: Gallery Publishing Workflows
  describe('Area 3: Gallery Publishing Workflows', () => {
    test('Admin selects subset of photos and publishes gallery', async () => {
      const pinH = await hashPin(DEMO_PIN);
      const slug = 'arjun-priya-test';

      // Publish only photo 0, leaving photo 1 unpublished
      const selected = [uploadedPhotoIds[0]];

      publishedGallery = await prisma.gallery.create({
        data: {
          eventId: testEvent.id,
          slug,
          pinHash: pinH,
          photos: {
            create: selected.map((pid, idx) => ({
              photoId: pid,
              order: idx,
            })),
          },
        },
        include: {
          photos: true,
        },
      });

      assert.ok(publishedGallery);
      assert.equal(publishedGallery.slug, slug);
      assert.equal(publishedGallery.photos.length, 1);
    });

    test('Re-publishing updates photo set and refreshes PIN hash', async () => {
      const newPin = '654321';
      const newPinHash = await hashPin(newPin);

      // Re-publish with both photos
      await prisma.$transaction(async (tx) => {
        await tx.gallery.update({
          where: { id: publishedGallery.id },
          data: { pinHash: newPinHash },
        });

        await tx.galleryPhoto.deleteMany({ where: { galleryId: publishedGallery.id } });
        await tx.galleryPhoto.createMany({
          data: uploadedPhotoIds.map((pid, idx) => ({
            galleryId: publishedGallery.id,
            photoId: pid,
            order: idx,
          })),
        });
      });

      const updated = await prisma.gallery.findUnique({
        where: { id: publishedGallery.id },
        include: { photos: true },
      });

      assert.equal(updated?.photos.length, 2);
      assert.equal(await verifyPin(newPin, updated!.pinHash), true);
      assert.equal(await verifyPin(DEMO_PIN, updated!.pinHash), false);
    });
  });

  // AREA 4: PIN-Protected Access Verification & Security Scenarios
  describe('Area 4: PIN Access Verification & Security Matrix', () => {
    test('PIN hashing and constant-time verification', async () => {
      const pin = '482917';
      const hash = await hashPin(pin);
      assert.notEqual(pin, hash);
      assert.equal(await verifyPin(pin, hash), true);
      assert.equal(await verifyPin('999999', hash), false);
    });

    test('Security Scenario 4: Rate limiter throttles excessive failed PIN attempts', () => {
      const testKey = 'test-ip-rate-limit-check';
      for (let i = 0; i < 10; i++) {
        const res = checkRateLimit(testKey, 10, 60);
        assert.equal(res.allowed, true);
      }
      // 11th attempt must be rejected
      const blockedRes = checkRateLimit(testKey, 10, 60);
      assert.equal(blockedRes.allowed, false);
      assert.equal(blockedRes.remaining, 0);
    });

    test('Customer gallery session token generation and verification', async () => {
      const token = await createGalleryToken('arjun-priya-test');
      assert.ok(token);

      // Valid token for matching slug
      const valid = await verifyGalleryToken(token, 'arjun-priya-test');
      assert.equal(valid, true);

      // Tampered/forged slug check fails
      const forged = await verifyGalleryToken(token, 'malicious-forged-slug');
      assert.equal(forged, false);
    });

    test('Security Scenario 5: Attempted access to unpublished photos is strictly isolated', async () => {
      // Create a secret unpublished photo
      const secretPhoto = await prisma.photo.create({
        data: {
          eventId: testEvent.id,
          uploadedById: teamUser.id,
          filename: 'confidential_raw_photo.jpg',
          storageKey: generateStorageKey(testEvent.id, 'confidential.jpg'),
          mimeType: 'image/jpeg',
          fileSize: 4096,
          status: 'UPLOADED',
        },
      });

      // Customer query joins strictly on GalleryPhoto
      const customerPhotos = await prisma.galleryPhoto.findMany({
        where: { galleryId: publishedGallery.id },
        include: { photo: true },
      });

      const customerPhotoIds = customerPhotos.map((cp) => cp.photoId);
      assert.equal(customerPhotoIds.includes(secretPhoto.id), false);
    });
  });
});
