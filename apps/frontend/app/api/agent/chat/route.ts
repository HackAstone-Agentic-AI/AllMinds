import { NextRequest, NextResponse } from 'next/server';

const AGENTIC_AI_URL =
  process.env.AGENTIC_AI_URL ||
  'http://127.0.0.1:8000';

export async function POST(request: NextRequest) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${AGENTIC_AI_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(request.headers.get('authorization')
          ? { Authorization: request.headers.get('authorization') as string }
          : {}),
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
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
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to reach the agent service.',
      },
      { status: 502 },
    );
  }
}
