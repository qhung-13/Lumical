import { IdentityScreen } from '../../features/identity/identity-screen';
import { safeReturnTo, singleSearchParam } from '../../features/identity/safe-return';
export const metadata = { title: 'LumiCal | Create account', robots: { index: false, follow: false } };
export default async function RegistrationPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const params = await searchParams;
  return <IdentityScreen mode="register" returnTo={safeReturnTo(singleSearchParam(params.next))} />;
}
