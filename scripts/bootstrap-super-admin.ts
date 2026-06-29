import 'dotenv/config';
import prisma from '../src/config/database';

const ALL_SCOPES = [
  'super_admin',
  'manage_admins',
  'manage_coaches',
  'manage_cosmetics',
  'manage_missions',
  'manage_partners',
  'manage_analytics',
  'manage_uploads',
];

async function bootstrapSuperAdmin(): Promise<void> {
  console.log('Bootstrapping super admin...');

  const adminUser = await prisma.user.findFirst({
    where: { is_admin: true },
  });

  if (!adminUser) {
    console.log(
      'No admin user found with is_admin = true. Nothing to bootstrap.'
    );
    return;
  }

  console.log(
    `Found admin: ${adminUser.email} (${adminUser.supabase_auth_id})`
  );

  const existingScopes = await prisma.admin_scope.findMany({
    where: { supabase_auth_id: adminUser.supabase_auth_id },
  });

  const existingScopeNames = new Set(existingScopes.map((s) => s.scope));
  const missingScopes = ALL_SCOPES.filter((s) => !existingScopeNames.has(s));

  if (missingScopes.length === 0) {
    console.log('All scopes already present. Nothing to do.');
    return;
  }

  await prisma.admin_scope.createMany({
    data: missingScopes.map((scope) => ({
      supabase_auth_id: adminUser.supabase_auth_id,
      scope,
    })),
    skipDuplicates: true,
  });

  console.log(`Added scopes: ${missingScopes.join(', ')}`);
  console.log('Super admin bootstrap complete.');

  await prisma.$disconnect();
}

bootstrapSuperAdmin().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
