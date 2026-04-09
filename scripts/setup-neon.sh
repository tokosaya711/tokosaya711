# ============================================
# SETUP DATABASE - NEON (FREE POSTGRESQL)
# ============================================
#
# Langkah-langkah:
#
# 1. Buka https://neon.tech dan daftar (gratis)
# 2. Buat project baru
# 3. Copy connection string yang diberikan
#    Format: postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
#
# 4. Di Vercel Dashboard:
#    - Buka project -> Settings -> Environment Variables
#    - Tambahkan:
#      DATABASE_URL = (connection string dari Neon, dengan ?sslmode=require&pgbouncer=true)
#      DIRECT_URL = (connection string dari Neon, dengan ?sslmode=require)
#      JWT_SECRET = (buat string acak yang panjang)
#
# 5. Redeploy di Vercel
#    - Buka Deployments -> klik "Redeploy"
#
# ============================================
