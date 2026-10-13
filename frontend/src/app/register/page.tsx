import { IdentityScreen } from '../../features/identity/identity-screen';
import { identityPreferences } from '../../lib/identity-preferences';
export const metadata = { title: 'LumiCal | Create account', robots: { index: false, follow: false } };
export default async function RegistrationPage() { return <IdentityScreen mode="register" {...await identityPreferences()} />; }
