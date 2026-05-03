import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AuditVault',
  description: 'Maritime audit management for Nivyash',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
