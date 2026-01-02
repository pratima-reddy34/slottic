// This API route is deprecated and no longer in use.
// The logic has been moved to a dedicated backend service on Cloud Run.
// The frontend now calls the Cloud Run URL directly.
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  return NextResponse.json(
    { error: "This API route is deprecated. Please use the Cloud Run service URL." },
    { status: 410 } // 410 Gone
  );
}
