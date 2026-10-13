import { IdentityScreen } from '../../features/identity/identity-screen';
import { identityPreferences } from '../../lib/identity-preferences';
export const metadata = { title: 'LumiCal | Log in', robots: { index: false, follow: false } };
export default async function LoginPage() { return <IdentityScreen mode="login" {...await identityPreferences()} />; }
