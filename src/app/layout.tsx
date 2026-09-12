import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BloodConnect — Real-Time Blood Donation & Emergency Resource Locator',
  description:
    'Find nearby blood banks, respond to urgent blood requests, and locate donation camps in real time.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );
}
