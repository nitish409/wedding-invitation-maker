'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, Video, ShieldCheck, LayoutGrid } from 'lucide-react';

export const Navbar: React.FC = () => {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 bg-[#3B0510]/95 backdrop-blur-md border-b border-[#D4AF37]/35 text-[#FFFDF9]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-full bg-gold-shimmer flex items-center justify-center text-[#3B0510] font-bold shadow-md">
            ॐ
          </div>
          <div>
            <span className="text-xl sm:text-2xl font-bold font-royal tracking-wide text-[#F3E5AB] group-hover:text-[#D4AF37] transition">
              ShubhVivah
            </span>
            <span className="hidden sm:inline-block ml-2 text-xs uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#D4AF37]/20 text-[#F3E5AB] border border-[#D4AF37]/40">
              HD Video Studio
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-5">
          <Link
            href="/#templates"
            className="text-sm font-medium text-[#F3E5AB]/85 hover:text-[#D4AF37] transition flex items-center gap-1.5 px-2 py-1"
          >
            <LayoutGrid className="w-4 h-4 text-[#D4AF37]" />
            <span className="hidden sm:inline">Templates</span>
          </Link>

          <Link
            href="/admin"
            className={`text-sm font-medium transition flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${
              pathname?.startsWith('/admin')
                ? 'bg-[#D4AF37]/25 text-[#F3E5AB] border border-[#D4AF37]/50'
                : 'text-[#F3E5AB]/80 hover:text-[#D4AF37]'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
            <span className="hidden md:inline">Admin</span>
          </Link>

          <Link
            href="/create"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold-shimmer text-[#3B0510] font-semibold text-sm shadow-lg hover:brightness-105 transition"
          >
            <Sparkles className="w-4 h-4" />
            <span>Create My Invitation</span>
          </Link>
        </nav>
      </div>
    </header>
  );
};
