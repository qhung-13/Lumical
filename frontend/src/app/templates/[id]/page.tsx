import type { Metadata } from 'next';
import { TemplateDetailScreen } from '../../../features/templates/template-screens';

export const metadata: Metadata = { title: 'Calendar design | LumiCal', description: 'Explore a curated calendar design.' };
export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TemplateDetailScreen id={id} />;
}
