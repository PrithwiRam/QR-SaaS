import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // ─── Super Admin ─────────────────────────────────────────────
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@qrsaas.com'
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'admin123'

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } })

  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 12),
        role: 'SUPER_ADMIN',
        restaurantId: null,
      },
    })
    console.log(`✅ Super admin created: ${adminEmail}`)
  } else {
    console.log(`ℹ️  Super admin already exists: ${adminEmail}`)
  }

  console.log('\n🎉 Seed complete!')
  console.log('\n📋 Login credentials:')
  console.log(`   Super Admin: ${adminEmail} / ${adminPassword}`)
  console.log('\n📝 Note: Add restaurants via the Admin Portal → Restaurant Dashboard')
  console.log('   Admin portal: http://localhost:3000/admin')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
