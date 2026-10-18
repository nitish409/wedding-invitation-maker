import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'ShubhVivah Studio — Create Your Dream Wedding Invitation Video in Minutes',
  description:
    'Create animated Indian wedding invitation HD MP4 videos with Ganesh Ji intro, royal mandalas, couple portraits, ceremony schedules, and background music.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-[#FFFDF9] text-[#2D0A12] antialiased">
        <Navbar />
        <main className="flex-1">{children}</main>
        <footer className="bg-[#2D040D] text-[#F3E5AB] border-t border-[#D4AF37]/30 py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <div className="text-xl font-bold font-royal tracking-wide text-[#D4AF37]">
                ✦ ShubhVivah Studio • शुभ विवाह स्टूडियो ✦
              </div>
              <p className="text-sm text-[#F3E5AB]/75 mt-1">
                Premium Animated Indian Wedding Invitation Video Maker • 1080×1920 HD MP4
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-6 text-sm text-[#F3E5AB]/80">
              <a href="/" className="hover:text-[#D4AF37] transition">
                Home
              </a>
              <a href="/create" className="hover:text-[#D4AF37] transition">
                Create Invitation
              </a>
              <a href="/admin" className="hover:text-[#D4AF37] transition">
                Admin Dashboard
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
