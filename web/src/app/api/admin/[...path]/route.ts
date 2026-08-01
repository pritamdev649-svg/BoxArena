import { NextResponse, type NextRequest } from 'next/server';
import { apiFetch, ApiError } from '@/shared/lib/api';
import { getAdminToken } from '@/shared/lib/panel-auth';

/**
 * BFF proxy for admin mutations.
 *
 * The browser never holds the admin access token — it calls this same-origin
 * route, which attaches the token server-side. An XSS that can read localStorage
 * therefore gains nothing (technical_spec.md §4.3).
 */
async function forward(
  request: NextRequest,
  params: Promise<{ path: string[] }>,
  method: 'POST' | 'PATCH',
) {
  const { path } = await params;
  const token = await getAdminToken();

  if (!token) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHENTICATED', message: 'Not signed in' } },
      { status: 401 },
    );
  }

  try {
    const body: unknown = await request.json();
    const data = await apiFetch(`/admin/${path.join('/')}`, { token, method, body });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Request failed' } },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(request, ctx.params, 'POST');
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(request, ctx.params, 'PATCH');
}
