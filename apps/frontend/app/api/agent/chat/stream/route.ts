import { NextRequest, NextResponse } from 'next/server';

const BACKEND_API_URL =
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:5000/api';

// Streams Thandi's reply (server-sent events) from the backend to the browser.
export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${BACKEND_API_URL.replace(/\/$/, '')}/agent/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(request.headers.get('authorization')
          ? { Authorization: request.headers.get('authorization') as string }
          : {}),
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: request.signal,
    });

    if (!upstream.ok || !upstream.body) {
      const data = await upstream.json().catch(() => null);
      return NextResponse.json(
        { error: (data && (data.error || data.detail)) || 'Agent service request failed.' },
        { status: upstream.status || 502 },
      );
    }

    return new Response(upstream.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Unable to reach the All Minds API.' }, { status: 502 });
  }
}
