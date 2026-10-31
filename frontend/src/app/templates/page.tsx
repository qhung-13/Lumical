import type { Metadata } from 'next';
import { TemplateCatalogScreen } from '../../features/templates/template-screens';

export const metadata: Metadata = { title: 'Template catalog | LumiCal', description: 'Explore curated bilingual calendar designs.' };
export default function TemplatesPage() { return <TemplateCatalogScreen />; }
