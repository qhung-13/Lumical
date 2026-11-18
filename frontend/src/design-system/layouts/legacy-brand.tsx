import Image from 'next/image';
import styles from './legacy-brand.module.css';

export function LegacyBrand({ inverse = false }: { inverse?: boolean }) {
  return <span className={styles.brand} data-inverse={inverse}>
    <Image className={styles.logo} src="/lumical-legacy-logo.webp" width={200} height={180} alt="LumiCal" />
    <span className={styles.inverse}><Image src="/lumical-legacy-mark-light.webp" width={124} height={120} alt="" />LumiCal</span>
  </span>;
}
