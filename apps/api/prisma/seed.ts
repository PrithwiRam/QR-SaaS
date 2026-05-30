import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { generateQrBulk } from '../src/services/qrService'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // ─── Super Admin ─────────────────────────────────────────────
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@qrsaas.com'
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'admin123'

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } })

  let superAdmin
  if (!existingAdmin) {
    superAdmin = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 12),
        role: 'SUPER_ADMIN',
        restaurantId: null,
      },
    })
    console.log(`✅ Super admin created: ${adminEmail} / ${adminPassword}`)
  } else {
    superAdmin = existingAdmin
    console.log(`ℹ️  Super admin already exists: ${adminEmail}`)
  }

  // ─── Demo Restaurant ─────────────────────────────────────────
  let restaurant = await prisma.restaurant.findUnique({ where: { slug: 'test-kitchen' } })

  if (!restaurant) {
    restaurant = await prisma.restaurant.create({
      data: {
        name: 'Test Kitchen',
        slug: 'test-kitchen',
        address: '123 Food Street, Flavor Town',
        phone: '+91 98765 43210',
      },
    })
    console.log('✅ Demo restaurant created: Test Kitchen (slug: test-kitchen)')
  } else {
    console.log('ℹ️  Demo restaurant already exists')
  }

  // ─── Vendor Admin User ────────────────────────────────────────
  const vendorEmail = 'vendor@test-kitchen.com'
  const existingVendor = await prisma.user.findUnique({ where: { email: vendorEmail } })

  if (!existingVendor) {
    await prisma.user.create({
      data: {
        email: vendorEmail,
        passwordHash: await bcrypt.hash('vendor123', 12),
        role: 'RESTAURANT_ADMIN',
        restaurantId: restaurant.id,
      },
    })
    console.log(`✅ Vendor admin created: ${vendorEmail} / vendor123`)
  }

  // ─── Menu Categories ─────────────────────────────────────────
  const categoryData = [
    { name: 'Starters', sortOrder: 0 },
    { name: 'Mains', sortOrder: 1 },
    { name: 'Desserts', sortOrder: 2 },
    { name: 'Drinks', sortOrder: 3 },
  ]

  const categories: Record<string, string> = {}
  for (const cat of categoryData) {
    const existing = await prisma.menuCategory.findFirst({
      where: { restaurantId: restaurant.id, name: cat.name },
    })
    if (!existing) {
      const created = await prisma.menuCategory.create({
        data: { restaurantId: restaurant.id, ...cat },
      })
      categories[cat.name] = created.id
      console.log(`✅ Category: ${cat.name}`)
    } else {
      categories[cat.name] = existing.id
    }
  }

  // ─── Menu Items ───────────────────────────────────────────────
  const menuItems = [
    // Starters
    { categoryName: 'Starters', name: 'Crispy Calamari', description: 'Lightly battered squid rings with garlic aioli', price: 12.99, sortOrder: 0 },
    { categoryName: 'Starters', name: 'Bruschetta', description: 'Toasted bread with fresh tomato, basil, and olive oil', price: 9.50, sortOrder: 1 },
    { categoryName: 'Starters', name: 'Soup of the Day', description: 'Ask your server for today\'s selection', price: 7.99, sortOrder: 2 },
    // Mains
    { categoryName: 'Mains', name: 'Grilled Salmon', description: 'Atlantic salmon with lemon butter, seasonal vegetables', price: 24.99, sortOrder: 0 },
    { categoryName: 'Mains', name: 'Margherita Pizza', description: 'San Marzano tomato, fresh mozzarella, basil', price: 18.50, sortOrder: 1 },
    { categoryName: 'Mains', name: 'Classic Beef Burger', description: '180g grass-fed beef, cheddar, lettuce, tomato, pickles', price: 16.99, sortOrder: 2 },
    { categoryName: 'Mains', name: 'Mushroom Risotto', description: 'Arborio rice, wild mushrooms, parmesan, truffle oil (V)', price: 17.50, sortOrder: 3 },
    { categoryName: 'Mains', name: 'Chicken Tikka Masala', description: 'Tender chicken in rich tomato-cream sauce, basmati rice', price: 19.99, sortOrder: 4 },
    // Desserts
    { categoryName: 'Desserts', name: 'Chocolate Lava Cake', description: 'Warm chocolate cake, vanilla ice cream', price: 8.99, sortOrder: 0 },
    { categoryName: 'Desserts', name: 'Crème Brûlée', description: 'Classic French custard with caramelized sugar', price: 7.50, sortOrder: 1 },
    // Drinks
    { categoryName: 'Drinks', name: 'Fresh Lemonade', description: 'House-made lemonade with mint', price: 4.50, sortOrder: 0 },
    { categoryName: 'Drinks', name: 'Sparkling Water', description: 'San Pellegrino 500ml', price: 3.50, sortOrder: 1 },
    { categoryName: 'Drinks', name: 'Americano Coffee', description: 'Double shot espresso with hot water', price: 3.99, sortOrder: 2 },
    { categoryName: 'Drinks', name: 'House Red Wine', description: 'Glass of our selected house red', price: 8.99, sortOrder: 3 },
  ]

  for (const item of menuItems) {
    const existing = await prisma.menuItem.findFirst({
      where: { restaurantId: restaurant.id, name: item.name },
    })
    if (!existing) {
      await prisma.menuItem.create({
        data: {
          restaurantId: restaurant.id,
          categoryId: categories[item.categoryName],
          name: item.name,
          description: item.description,
          price: item.price,
          sortOrder: item.sortOrder,
          isAvailable: true,
        },
      })
      console.log(`✅ Menu item: ${item.name}`)
    }
  }

  // ─── Tables + QR Codes ────────────────────────────────────────
  const existingTables = await prisma.table.count({ where: { restaurantId: restaurant.id } })

  if (existingTables === 0) {
    console.log('🔲 Generating QR codes for 5 tables...')
    await generateQrBulk(restaurant.id, 1, 5)
    console.log('✅ 5 tables with QR codes created')
  } else {
    console.log(`ℹ️  ${existingTables} tables already exist`)
  }

  console.log('\n🎉 Seed complete!')
  console.log('\n📋 Login credentials:')
  console.log(`   Super Admin:  admin@qrsaas.com / admin123`)
  console.log(`   Vendor Admin: vendor@test-kitchen.com / vendor123`)
  console.log(`\n🔗 URLs (after starting dev servers):`)
  console.log(`   Admin portal:  http://localhost:3000/admin`)
  console.log(`   Vendor portal: http://localhost:3000/vendor/test-kitchen`)
  console.log(`   Kitchen board: http://localhost:3000/vendor/test-kitchen/kitchen`)
  console.log(`   Customer menu: http://localhost:3000/menu/test-kitchen?table=<QR_TOKEN>`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
