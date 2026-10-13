import { IdentityScreen } from '../../features/identity/identity-screen';
import { identityPreferences } from '../../lib/identity-preferences';
export const metadata = { title: 'LumiCal | Your account', robots: { index: false, follow: false } };
export default async function AccountPage() { return <IdentityScreen mode="account" {...await identityPreferences()} />; }
