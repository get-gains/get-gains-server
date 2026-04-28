import 'dotenv/config';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { COSMETICS_CONFIG } from './cosmetics-config';
import { seedMissions } from './seed-missions';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding cosmetics...');

  for (const config of COSMETICS_CONFIG) {
    const cosmetic = await prisma.cosmetics.upsert({
      where: { unity_asset_ref: config.unityAssetRef },
      update: {
        name: config.name,
        description: config.description,
        tier: config.tier,
        price: config.price,
        sort_order: config.sortOrder,
        status: 'ACTIVE',
      },
      create: {
        name: config.name,
        description: config.description,
        tier: config.tier,
        price: config.price,
        unity_asset_ref: config.unityAssetRef,
        preview_image_key: '', // Replace with S3 key after uploading preview images
        status: 'ACTIVE',
        sort_order: config.sortOrder,
      },
    });

    console.log(
      `  ✓ ${cosmetic.name} (id: ${cosmetic.id}, price: ${cosmetic.price} coins)`
    );
  }

  console.log(`\nSeeded ${COSMETICS_CONFIG.length} cosmetics.`);

  await seedMissions(prisma);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
