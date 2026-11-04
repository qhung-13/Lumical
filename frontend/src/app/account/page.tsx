import { IdentityScreen } from '../../features/identity/identity-screen';
import { safeTemplateId, singleSearchParam } from '../../features/identity/safe-return';
export const metadata = { title: 'LumiCal | Your account', robots: { index: false, follow: false } };
export default async function AccountPage({ searchParams }: { searchParams: Promise<{ templateId?: string | string[] }> }) {
  const params = await searchParams;
  const templateId = safeTemplateId(singleSearchParam(params.templateId));
  const returnTo = `/account${templateId ? `?templateId=${encodeURIComponent(templateId)}` : ''}`;
  return <IdentityScreen mode="account" returnTo={returnTo} templateId={templateId} />;
}
