import { IdentityScreen } from '../../features/identity/identity-screen';
export const metadata = { title: 'LumiCal | Your account', robots: { index: false, follow: false } };
export default function AccountPage() { return <IdentityScreen mode="account" />; }
