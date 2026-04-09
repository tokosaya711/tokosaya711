import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Try a simple query to check if database is ready
    await db.user.count()
    return NextResponse.json({ status: 'ok', message: 'Database is ready' })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { status: 'error', message: 'Database not configured. Please set DATABASE_URL environment variable.' },
      { status: 503 }
    )
  }
}
