import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { signToken } from '@/lib/auth';

// ── Sample data definitions ──────────────────────────────────────
const SAMPLE_CATEGORIES = [
  { name: 'Kue Jajanan Pasar', type: 'cake' },
  { name: 'Kue Kering', type: 'cake' },
  { name: 'Tart & Pie', type: 'cake' },
  { name: 'Bolu & Sponge', type: 'cake' },
  { name: 'Dessert Box', type: 'cake' },
  { name: 'Makanan Kaki Lima', type: 'food' },
  { name: 'Cemilan', type: 'food' },
  { name: 'Minuman', type: 'food' },
  { name: 'Bahan Pokok', type: 'sembako' },
  { name: 'Kebutuhan Rumah Tangga', type: 'sembako' },
];

const SAMPLE_PRODUCTS = [
  // ── Kue Jajanan Pasar ──
  { name: 'Klepon', price: 3000, capitalPrice: 1500, stock: 100, image: '/uploads/products/klepon.png', categoryName: 'Kue Jajanan Pasar', categoryType: 'cake' },
  { name: 'Onde-Onde', price: 4000, capitalPrice: 2000, stock: 80, image: '/uploads/products/onde-onde.png', categoryName: 'Kue Jajanan Pasar', categoryType: 'cake' },
  { name: 'Kue Lapis', price: 5000, capitalPrice: 2500, stock: 60, image: '/uploads/products/kue-lapis.png', categoryName: 'Kue Jajanan Pasar', categoryType: 'cake' },
  { name: 'Nagasari', price: 3000, capitalPrice: 1200, stock: 80, image: '/uploads/products/nagasari.png', categoryName: 'Kue Jajanan Pasar', categoryType: 'cake' },
  { name: 'Serabi', price: 5000, capitalPrice: 2000, stock: 60, image: '/uploads/products/serabi.png', categoryName: 'Kue Jajanan Pasar', categoryType: 'cake' },
  { name: 'Getuk', price: 4000, capitalPrice: 1500, stock: 70, image: '/uploads/products/getuk.png', categoryName: 'Kue Jajanan Pasar', categoryType: 'cake' },
  { name: 'Kue Apem', price: 3000, capitalPrice: 1000, stock: 90, image: '/uploads/products/apem.png', categoryName: 'Kue Jajanan Pasar', categoryType: 'cake' },
  { name: 'Putu Ayu', price: 5000, capitalPrice: 2000, stock: 60, image: '/uploads/products/putu-ayu.png', categoryName: 'Kue Jajanan Pasar', categoryType: 'cake' },
  { name: 'Cenil', price: 4000, capitalPrice: 1500, stock: 70, image: '/uploads/products/cenil.png', categoryName: 'Kue Jajanan Pasar', categoryType: 'cake' },
  // ── Kue Kering ──
  { name: 'Kastengel', price: 55000, capitalPrice: 35000, stock: 40, image: '/uploads/products/kastengel.png', categoryName: 'Kue Kering', categoryType: 'cake' },
  { name: 'Nastar Keju', price: 50000, capitalPrice: 30000, stock: 45, image: '/uploads/products/nastar-keju.png', categoryName: 'Kue Kering', categoryType: 'cake' },
  // ── Tart & Pie ──
  { name: 'Apple Pie', price: 55000, capitalPrice: 30000, stock: 20, image: '/uploads/products/apple-pie.png', categoryName: 'Tart & Pie', categoryType: 'cake' },
  { name: 'Chocolate Tart', price: 50000, capitalPrice: 28000, stock: 20, image: '/uploads/products/chocolate-tart.png', categoryName: 'Tart & Pie', categoryType: 'cake' },
  // ── Bolu & Sponge ──
  { name: 'Chocolate Cake', price: 85000, capitalPrice: 45000, stock: 20, image: '/uploads/products/chocolate-cake.png', categoryName: 'Bolu & Sponge', categoryType: 'cake' },
  { name: 'Red Velvet', price: 95000, capitalPrice: 50000, stock: 15, image: '/uploads/products/red-velvet.png', categoryName: 'Bolu & Sponge', categoryType: 'cake' },
  { name: 'Rainbow Cake', price: 120000, capitalPrice: 65000, stock: 10, image: '/uploads/products/rainbow-cake.png', categoryName: 'Bolu & Sponge', categoryType: 'cake' },
  { name: 'Brownies Panggang', price: 45000, capitalPrice: 22000, stock: 30, image: '/uploads/products/brownies.png', categoryName: 'Bolu & Sponge', categoryType: 'cake' },
  // ── Dessert Box ──
  { name: 'Tiramisu', price: 55000, capitalPrice: 30000, stock: 20, image: '/uploads/products/tiramisu.png', categoryName: 'Dessert Box', categoryType: 'cake' },
  { name: 'Cheesecake', price: 65000, capitalPrice: 35000, stock: 18, image: '/uploads/products/cheesecake.png', categoryName: 'Dessert Box', categoryType: 'cake' },
  // ── Makanan Kaki Lima (5 produk utama) ──
  { name: 'Nasi Goreng Spesial', price: 15000, capitalPrice: 7000, stock: 50, image: '/uploads/products/nasi-goreng-kaki-lima-v2.png', categoryName: 'Makanan Kaki Lima', categoryType: 'food' },
  { name: 'Bakso Urat', price: 15000, capitalPrice: 8000, stock: 50, image: '/uploads/products/bakso-kaki-lima-v2.png', categoryName: 'Makanan Kaki Lima', categoryType: 'food' },
  { name: 'Sate Ayam Madura', price: 20000, capitalPrice: 10000, stock: 40, image: '/uploads/products/sate-ayam-kaki-lima-v2.png', categoryName: 'Makanan Kaki Lima', categoryType: 'food' },
  { name: 'Mie Ayam Bakso', price: 13000, capitalPrice: 7000, stock: 50, image: '/uploads/products/mie-ayam-kaki-lima-v2.png', categoryName: 'Makanan Kaki Lima', categoryType: 'food' },
  { name: 'Gorengan Campur', price: 5000, capitalPrice: 2000, stock: 100, image: '/uploads/products/gorengan-kaki-lima-v2.png', categoryName: 'Makanan Kaki Lima', categoryType: 'food' },
  // ── Cemilan ──
  { name: 'Risoles Mayo', price: 5000, capitalPrice: 2500, stock: 80, image: '/uploads/products/risoles-mayo.png', categoryName: 'Cemilan', categoryType: 'food' },
  { name: 'Dimsum Ayam', price: 10000, capitalPrice: 5000, stock: 60, image: '/uploads/products/dimsum-ayam.png', categoryName: 'Cemilan', categoryType: 'food' },
  { name: 'Roti Bakar Coklat Keju', price: 18000, capitalPrice: 8000, stock: 35, image: '/uploads/products/roti-bakar.png', categoryName: 'Cemilan', categoryType: 'food' },
  { name: 'Croissant Butter', price: 20000, capitalPrice: 10000, stock: 25, image: '/uploads/products/croissant.png', categoryName: 'Cemilan', categoryType: 'food' },
  { name: 'Donat Glazed', price: 12000, capitalPrice: 5000, stock: 60, image: '/uploads/products/donat.png', categoryName: 'Cemilan', categoryType: 'food' },
  { name: 'Club Sandwich', price: 28000, capitalPrice: 14000, stock: 30, image: '/uploads/products/sandwich.png', categoryName: 'Cemilan', categoryType: 'food' },
  // ── Minuman ──
  { name: 'Es Teh Manis', price: 5000, capitalPrice: 1500, stock: 100, image: '/uploads/products/es-teh-manis.png', categoryName: 'Minuman', categoryType: 'food' },
  { name: 'Kopi Susu Gula Aren', price: 15000, capitalPrice: 5000, stock: 60, image: '/uploads/products/kopi-susu-gula-aren.png', categoryName: 'Minuman', categoryType: 'food' },
  // ── Bahan Pokok ──
  { name: 'Beras Premium 5kg', price: 65000, capitalPrice: 58000, stock: 50, image: '/uploads/products/beras.png', categoryName: 'Bahan Pokok', categoryType: 'sembako' },
  { name: 'Minyak Goreng 2L', price: 32000, capitalPrice: 28000, stock: 60, image: '/uploads/products/minyak-goreng.png', categoryName: 'Bahan Pokok', categoryType: 'sembako' },
  { name: 'Gula Pasir 1kg', price: 16000, capitalPrice: 14000, stock: 80, image: '/uploads/products/gula-pasir.png', categoryName: 'Bahan Pokok', categoryType: 'sembako' },
  { name: 'Telur Ayam 1kg', price: 28000, capitalPrice: 24000, stock: 40, image: '/uploads/products/telur-ayam.png', categoryName: 'Bahan Pokok', categoryType: 'sembako' },
  { name: 'Mie Instan (5pcs)', price: 13500, capitalPrice: 11000, stock: 100, image: '/uploads/products/mie-instan.png', categoryName: 'Bahan Pokok', categoryType: 'sembako' },
  { name: 'Kecap Manis 600ml', price: 18000, capitalPrice: 14000, stock: 50, image: '/uploads/products/kecap-manis.png', categoryName: 'Bahan Pokok', categoryType: 'sembako' },
  // ── Kebutuhan Rumah Tangga ──
  { name: 'Sabun Cuci 800g', price: 22000, capitalPrice: 17000, stock: 50, image: '/uploads/products/sabun-cuci.png', categoryName: 'Kebutuhan Rumah Tangga', categoryType: 'sembako' },
  { name: 'Air Mineral 600ml', price: 4000, capitalPrice: 2500, stock: 200, image: '/uploads/products/air-mineral.png', categoryName: 'Kebutuhan Rumah Tangga', categoryType: 'sembako' },
];

async function seedSampleData(ownerId: string) {
  // Create categories
  for (const cat of SAMPLE_CATEGORIES) {
    const exists = await db.category.findFirst({
      where: { name: cat.name, type: cat.type, ownerId },
    });
    if (!exists) {
      await db.category.create({ data: { name: cat.name, type: cat.type, ownerId } });
    }
  }

  // Create or update products
  for (const product of SAMPLE_PRODUCTS) {
    const category = await db.category.findFirst({
      where: { name: product.categoryName, type: product.categoryType, ownerId },
    });
    if (category) {
      const exists = await db.product.findFirst({
        where: { name: product.name, ownerId },
      });
      if (!exists) {
        await db.product.create({
          data: {
            name: product.name,
            price: product.price,
            capitalPrice: (product as { capitalPrice?: number }).capitalPrice || 0,
            stock: product.stock,
            image: product.image,
            categoryId: category.id,
            isActive: true,
            ownerId,
          },
        });
      } else if (!exists.image) {
        // Update existing product with image if it doesn't have one
        await db.product.update({
          where: { id: exists.id },
          data: {
            image: product.image,
            price: product.price,
            stock: product.stock,
            categoryId: category.id,
          },
        });
      }
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, phone, username, address } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Nama, email, dan password wajib diisi' },
        { status: 400 }
      );
    }

    if (!username || username.length < 3) {
      return NextResponse.json(
        { error: 'Username wajib diisi minimal 3 karakter' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 409 });
    }

    // Check if username already exists
    const existingUsername = await db.user.findUnique({ where: { username } });
    if (existingUsername) {
      return NextResponse.json({ error: 'Username sudah digunakan' }, { status: 409 });
    }

    // Default demo period (7 days)
    const demoPeriodDays = 7;
    const demoExpiresAt = new Date();
    demoExpiresAt.setDate(demoExpiresAt.getDate() + demoPeriodDays);

    // Hash password
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with 'demo' role (appears in daftar pembeli, has trial permissions)
    const newUser = await db.user.create({
      data: {
        name,
        username,
        email,
        password: hashedPassword,
        phone: phone || undefined,
        role: 'demo',
        isDemo: true,
        demoExpiresAt,
      },
    });

    // Create a Customer entry with the same name and phone
    await db.customer.create({
      data: {
        name,
        phone: phone || undefined,
        address: address || undefined,
        ownerId: newUser.id,
      },
    });

    // Seed sample data (categories + products with images) for this user
    try {
      await seedSampleData(newUser.id);
    } catch (seedError) {
      console.error('[REGISTER] Failed to seed sample data for user', newUser.id, seedError);
      // Don't fail registration — user can still use the app, just without sample data
    }

    // Seed sample customers with Indonesian phone numbers
    const sampleCustomers = [
      { name: 'Ibu Ani', phone: '081234567890', address: 'Jl. Merdeka No. 10, Jakarta Selatan' },
      { name: 'Pak Budi', phone: '082345678901', address: 'Jl. Sudirman No. 25, Bandung' },
      { name: 'Ibu Sari', phone: '083456789012', address: 'Jl. Gatot Subroto No. 5, Surabaya' },
      { name: 'Pak Dedi', phone: '084567890123', address: 'Jl. Asia Afrika No. 15, Semarang' },
      { name: 'Ibu Rina', phone: '085678901234', address: 'Jl. Diponegoro No. 30, Yogyakarta' },
    ];
    for (const cust of sampleCustomers) {
      await db.customer.create({
        data: { ...cust, ownerId: newUser.id },
      });
    }

    // Create StoreSettings for this user with defaults
    await db.storeSettings.create({
      data: {
        ownerId: newUser.id,
        storeName: 'TOKO SAYA',
        storeLogo: '/api/files/logos/default-store-logo.png',
      },
    });

    // Generate token
    const token = signToken({
      userId: newUser.id,
      email: newUser.email,
      name: newUser.name,
      username: newUser.username,
      role: newUser.role,
      isDemo: newUser.isDemo,
      ...(newUser.demoExpiresAt && { demoExpiresAt: newUser.demoExpiresAt.toISOString() }),
    });

    return NextResponse.json({
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        username: newUser.username,
        role: newUser.role,
        isDemo: newUser.isDemo,
        demoExpiresAt: newUser.demoExpiresAt ? newUser.demoExpiresAt.toISOString() : null,
      },
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
