import { ProjectDetail } from '../../../features/calendar-projects/project-detail';
export const metadata = { title: 'LumiCal | Saved calendar', robots: { index: false, follow: false } };
export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectDetail id={id} />;
}
