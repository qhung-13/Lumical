import { SavedCalendarPreviewPage } from '../../../../features/calendar-projects/saved-calendar-preview-page';

export const metadata = { title: 'LumiCal | Calendar preview', robots: { index: false, follow: false } };

export default async function ProjectPreviewRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SavedCalendarPreviewPage id={id} />;
}
