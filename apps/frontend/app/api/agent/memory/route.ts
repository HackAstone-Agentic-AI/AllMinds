import { NextRequest, NextResponse } from 'next/server';

const BACKEND_API_URL =
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:5000/api';

async function forward(request: NextRequest, method: 'GET' | 'DELETE') {
  try {
    const upstream = await fetch(`${BACKEND_API_URL.replace(/\/$/, '')}/agent/memory`, {
      method,
      headers: request.headers.get('authorization')
        ? { Authorization: request.headers.get('authorization') as string }
        : {},
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    });
    const data = await upstream.json().catch(() => null);
    return NextResponse.json(data ?? {}, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: 'Unable to reach the All Minds API.' }, { status: 502 });
  }
}

export async function GET(request: NextRequest) {
  return forward(request, 'GET');
}

export async function DELETE(request: NextRequest) {
  return forward(request, 'DELETE');
}
