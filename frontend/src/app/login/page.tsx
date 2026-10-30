import { IdentityScreen } from '../../features/identity/identity-screen';
import { safeReturnTo, singleSearchParam } from '../../features/identity/safe-return';
export const metadata = { title: 'LumiCal | Log in', robots: { index: false, follow: false } };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const params = await searchParams;
  return <IdentityScreen mode="login" returnTo={safeReturnTo(singleSearchParam(params.next))} />;
}
