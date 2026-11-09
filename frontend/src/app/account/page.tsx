import { safeTemplateId, singleSearchParam } from '../../features/identity/safe-return';
import { ProjectWorkspace } from '../../features/calendar-projects/project-workspace';
export const metadata = { title: 'LumiCal | Your account', robots: { index: false, follow: false } };
export default async function AccountPage({ searchParams }: { searchParams: Promise<{ templateId?: string | string[] }> }) {
  const params = await searchParams;
  const templateId = safeTemplateId(singleSearchParam(params.templateId));
  return <ProjectWorkspace templateId={templateId} />;
}
