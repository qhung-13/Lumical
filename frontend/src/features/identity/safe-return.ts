const TEMPLATE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ORIGIN = 'https://lumical.invalid';

export function safeTemplateId(value: string | null | undefined): string | undefined {
  return value && TEMPLATE_ID.test(value) ? value : undefined;
}

export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\u0000-\u001f\\]/u.test(value)) return '/account';
  try {
    const url = new URL(value, ORIGIN);
    if (url.origin !== ORIGIN || url.pathname !== '/account' || url.hash) return '/account';
    const ids = url.searchParams.getAll('templateId');
    if ([...url.searchParams.keys()].some(key => key !== 'templateId') || ids.length > 1) return '/account';
    if (!ids.length) return '/account';
    const id = safeTemplateId(ids[0]);
    return id ? `/account?templateId=${encodeURIComponent(id)}` : '/account';
  } catch {
    return '/account';
  }
}

export function singleSearchParam(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
