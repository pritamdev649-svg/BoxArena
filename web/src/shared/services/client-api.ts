/**
 * Client-side fetch helper for Browser/Client components.
 * Automatically forwards admin requests to the local BFF proxy and player/owner requests to the backend API.
 */
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api/v1';

export async function clientFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const isAdminPath = path.startsWith('/admin');
  const url = isAdminPath ? `/api${path}` : `${BASE_URL}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error?.message || 'API request failed');
  }
  return result.data as T;
}
