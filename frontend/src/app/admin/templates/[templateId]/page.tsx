import type { Metadata } from 'next';
import { TemplateDetailScreen } from '../../../../features/admin-template/template-detail-screen';

export const metadata: Metadata = { title: 'Manage template | LumiCal Admin', description: 'Publish revisions and change template availability.' };

export default async function AdminTemplateDetailPage({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  return <TemplateDetailScreen templateId={templateId} />;
}
