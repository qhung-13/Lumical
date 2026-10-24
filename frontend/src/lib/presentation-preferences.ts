import { cookies } from 'next/headers';
import { presentationPreferences } from '../design-system/foundations/preferences';
export async function serverPreferences() {
  const store = await cookies();
  return presentationPreferences(store.get('lumical_locale')?.value, store.get('lumical_theme')?.value);
}
