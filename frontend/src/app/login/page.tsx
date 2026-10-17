import { IdentityScreen } from '../../features/identity/identity-screen';
export const metadata = { title: 'LumiCal | Log in', robots: { index: false, follow: false } };
export default function LoginPage() { return <IdentityScreen mode="login" />; }
