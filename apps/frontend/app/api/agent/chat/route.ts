import { NextRequest, NextResponse } from 'next/server';

const BACKEND_API_URL =
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:5000/api';

export async function POST(request: NextRequest) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${BACKEND_API_URL.replace(/\/$/, '')}/agent/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(request.headers.get('authorization')
          ? { Authorization: request.headers.get('authorization') as string }
          : {}),
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: AbortSignal.timeout(90_000),
    });

    const data = await upstream.json().catch(() => null);

    if (!upstream.ok) {
      const errorMessage =
        data && typeof data === 'object' && 'detail' in data
          ? String((data as { detail: unknown }).detail)
          : data && typeof data === 'object' && 'error' in data
          ? String((data as { error: unknown }).error)
          : 'Agent service request failed.';

      return NextResponse.json({ error: errorMessage }, { status: upstream.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    return NextResponse.json(
      {
        error: timedOut
          ? 'The AI request timed out. Please try again.'
          : 'Unable to reach the All Minds API.',
      },
      { status: 502 },
    );
  }
}
