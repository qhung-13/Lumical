import { Studio } from '../../../../features/calendar-projects/studio';

export const metadata = { title: 'LumiCal | Studio', robots: { index: false, follow: false } };

export default async function StudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Studio id={id} />;
}
