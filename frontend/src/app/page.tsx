import type { Metadata } from 'next';
import { PublicShell } from '../design-system/layouts/public-shell';
import { ProductHome } from '../features/product-home/product-home';
import { productCopy } from '../i18n/product';
import { serverPreferences } from '../lib/presentation-preferences';

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await serverPreferences();
  const { title, intro } = productCopy[locale];
  return { title: `LumiCal | ${title}`, description: intro };
}

export default function Home() {
  return <PublicShell fullWidth><ProductHome /></PublicShell>;
}
