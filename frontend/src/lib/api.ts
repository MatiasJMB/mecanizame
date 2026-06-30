const API_BASE_URL = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, '') || '';

function buildApiUrl(path: string) {
  if (!API_BASE_URL || path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildApiUrl(path), init);
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const data = await response.json();

    if (!response.ok) {
      const message = typeof data?.message === 'string' ? data.message : 'La API respondio con error.';
      throw new Error(message);
    }

    return data as T;
  }

  const rawText = await response.text();
  const textPreview = rawText.trim().slice(0, 120);

  if (!response.ok) {
    throw new Error(textPreview || `La API devolvio ${response.status}.`);
  }

  throw new Error(
    `La API devolvio HTML en vez de JSON. Revisa VITE_BACKEND_URL/proxy. Preview: ${textPreview || '<vacio>'}`
  );
}

export { buildApiUrl };
