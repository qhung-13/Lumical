import type { Metadata } from 'next';
import { TemplateListScreen } from '../../../features/admin-template/template-list-screen';

export const metadata: Metadata = { title: 'Templates | LumiCal Admin', description: 'Operational template catalog management.' };
export default function AdminTemplatesPage() { return <TemplateListScreen />; }
