import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// 1x1 valid sample JPEG buffer so images render cleanly
const SAMPLE_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
  0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
  0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
  0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
  0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
  0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
  0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
  0x00, 0xbf, 0x80, 0xff, 0xd9,
]);

async function main() {
  console.log('Seeding Trizen Photo Share database...');

  // Clean existing data
  await prisma.galleryPhoto.deleteMany({});
  await prisma.gallery.deleteMany({});
  await prisma.photo.deleteMany({});
  await prisma.eventMember.deleteMany({});
  await prisma.event.deleteMany({});
  await prisma.user.deleteMany({});

  // 1. Seed Admin user
  const adminPasswordHash = await bcrypt.hash('Admin@123456', 10);
  const admin = await prisma.user.create({
    data: {
      email: 'admin@trizen.com',
      name: 'Lead Admin',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
    },
  });
  console.log('Created Admin:', admin.email);

  // 2. Seed Team Member
  const teamPasswordHash = await bcrypt.hash('Team@123456', 10);
  const teamMember = await prisma.user.create({
    data: {
      email: 'team@trizen.com',
      name: 'Alex Photographer',
      passwordHash: teamPasswordHash,
      role: 'TEAM',
    },
  });
  console.log('Created Team Member:', teamMember.email);

  // 3. Seed Event
  const event = await prisma.event.create({
    data: {
      name: 'Arjun & Priya Wedding',
      description: 'Grand wedding reception and ceremonial photo shoots.',
      createdById: admin.id,
      members: {
        create: [{ userId: teamMember.id }],
      },
    },
  });
  console.log('Created Event:', event.name, `(${event.id})`);

  // Ensure uploads directory exists
  const uploadDir = path.resolve(process.cwd(), 'uploads');
  const eventDir = path.join(uploadDir, 'events', event.id);
  if (!fs.existsSync(eventDir)) {
    fs.mkdirSync(eventDir, { recursive: true });
  }

  // 4. Seed Photos
  const photoNames = [
    'Ceremony_Exchange_001.jpg',
    'Mandap_Rituals_002.jpg',
    'Couple_Sunset_Portrait_003.jpg',
    'Behind_The_Scenes_Raw_004.jpg', // Unselected / Unpublished
  ];

  const createdPhotos = [];
  for (let i = 0; i < photoNames.length; i++) {
    const filename = photoNames[i];
    const storageKey = `events/${event.id}/${i + 1}_${filename}`;
    const filePath = path.join(uploadDir, storageKey);

    fs.writeFileSync(filePath, SAMPLE_JPEG);

    const photo = await prisma.photo.create({
      data: {
        eventId: event.id,
        uploadedById: teamMember.id,
        filename,
        storageKey,
        mimeType: 'image/jpeg',
        fileSize: SAMPLE_JPEG.length,
        status: 'UPLOADED',
      },
    });
    createdPhotos.push(photo);
  }
  console.log(`Created ${createdPhotos.length} sample photos (3 published, 1 unpublished).`);

  // 5. Seed Published Gallery with PIN: 482917 (PDF Section 5 example)
  const pinHash = await bcrypt.hash('482917', 10);
  await prisma.gallery.create({
    data: {
      eventId: event.id,
      slug: 'arjun-priya-wedding',
      pinHash,
      photos: {
        create: [
          { photoId: createdPhotos[0].id, order: 0 },
          { photoId: createdPhotos[1].id, order: 1 },
          { photoId: createdPhotos[2].id, order: 2 },
          // Notice photo 3 is omitted — testing Scenario 5 (unpublished photos)
        ],
      },
    },
  });

  console.log('Created Published Gallery:');
  console.log('  URL Slug: /gallery/arjun-priya-wedding');
  console.log('  PIN:      482917');
  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
