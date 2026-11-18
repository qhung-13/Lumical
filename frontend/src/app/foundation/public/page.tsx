import type { Metadata } from 'next';
import { FoundationPage } from '../../../design-system/examples/foundation-page';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function PublicFoundationPage() {
  return <FoundationPage area="public" />;
}
