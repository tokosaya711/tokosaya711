#!/bin/sh
# This script runs during Vercel build.
# If DATABASE_URL points to PostgreSQL, switch schema to postgresql provider.
# Otherwise, keep SQLite for local development.

SCHEMA_FILE="prisma/schema.prisma"

if echo "$DATABASE_URL" | grep -q "^postgres"; then
  echo "✓ Detected PostgreSQL DATABASE_URL - updating schema provider"
  sed -i 's/provider = "sqlite"/provider = "postgresql"/' "$SCHEMA_FILE"
  # Add directUrl if not present
  if ! grep -q "directUrl" "$SCHEMA_FILE"; then
    sed -i 's|url      = env("DATABASE_URL")|url       = env("DATABASE_URL")\n  directUrl = env("DIRECT_URL")|' "$SCHEMA_FILE"
  fi
else
  echo "✓ Using SQLite for local development"
fi

# Generate Prisma client
npx prisma generate

# Push schema to database if PostgreSQL
if echo "$DATABASE_URL" | grep -q "^postgres"; then
  echo "✓ Pushing schema to PostgreSQL database..."
  npx prisma db push --skip-generate --accept-data-loss 2>/dev/null || echo "⚠ Schema push failed - database may already be up to date"
fi
