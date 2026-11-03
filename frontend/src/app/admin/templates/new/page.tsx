import type { Metadata } from 'next';
import { TemplateNewScreen } from '../../../../features/admin-template/template-new-screen';

export const metadata: Metadata = { title: 'New template | LumiCal Admin', description: 'Create an inactive template with its first revision.' };
export default function AdminTemplateNewPage() { return <TemplateNewScreen />; }
