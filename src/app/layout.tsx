
// app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import Footer from '@/components/Footer';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Slottic',
  description: 'Connect Cafés with Event Organizers',
  icons: {
    icon: 'https://firebasestorage.googleapis.com/v0/b/cafe-connector-gicmg.firebasestorage.app/o/android-chrome-512x512.png?alt=media&token=8477123b-d8b9-4f34-bccf-6951b891f2b5',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body 
        className={cn(
          'min-h-screen font-sans antialiased flex flex-col', 
          inter.variable
        )}
      >
        <AuthProvider>
          <div className="flex-grow">
            {children}
          </div>
          <Toaster />
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
