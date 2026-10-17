import { IdentityScreen } from '../../features/identity/identity-screen';
export const metadata = { title: 'LumiCal | Create account', robots: { index: false, follow: false } };
export default function RegistrationPage() { return <IdentityScreen mode="register" />; }
