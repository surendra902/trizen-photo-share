import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import { putObject } from '../src/lib/storage';

const prisma = new PrismaClient();

// Generate a real, visible 1200x800 JPEG per demo photo (distinct gradient + caption)
// so the seeded gallery looks like an actual shoot instead of a blank grid.
const PALETTE = [
  { top: '#b03a5b', bottom: '#f4c6d3' }, // rose
  { top: '#2f5d62', bottom: '#bfe3d0' }, // teal
  { top: '#c9772f', bottom: '#ffe3b3' }, // sunset
  { top: '#3d3b6e', bottom: '#d5d2f0' }, // indigo
];

async function makeSampleImage(filename: string, i: number): Promise<Buffer> {
  const { top, bottom } = PALETTE[i % PALETTE.length];
  const caption = filename.replace(/\.jpg$/i, '').replace(/_\d+$/, '').replace(/_/g, ' ');
  const svg = `<svg width="1200" height="800" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${top}"/><stop offset="100%" stop-color="${bottom}"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <text x="50%" y="46%" font-family="Georgia, serif" font-size="64" fill="#ffffff" text-anchor="middle" font-weight="bold">Arjun &amp; Priya</text>
    <text x="50%" y="56%" font-family="Georgia, serif" font-size="40" fill="#ffffff" text-anchor="middle" opacity="0.9">${caption}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
}

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
    const image = await makeSampleImage(filename, i);

    // Goes to S3/Filebase when STORAGE_DRIVER=s3, local uploads/ otherwise
    await putObject(storageKey, image, 'image/jpeg');

    const photo = await prisma.photo.create({
      data: {
        eventId: event.id,
        uploadedById: teamMember.id,
        filename,
        storageKey,
        mimeType: 'image/jpeg',
        fileSize: image.length,
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
