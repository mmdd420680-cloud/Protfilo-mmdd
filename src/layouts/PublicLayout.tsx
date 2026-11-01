import React, { useState } from 'react';
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom';
import {
  Shield,
  ArrowRight,
  Menu,
  X,
  Home,
} from 'lucide-react';
import { BrandLogo } from '../components/common/BrandLogo';
import { DynamicIcon } from '../components/common/DynamicIcon';
import { useSiteSettings } from '../context/SiteContext';

const PUBLIC_NAV_ITEMS = [
  { label: 'Home', to: '/', showHomeIcon: true },
  { label: 'Projects', to: '/projects' },
  { label: 'Services', to: '/services' },
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' },
];

export const PublicLayout: React.FC = () => {
  const { settings } = useSiteSettings();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const devName = settings?.developerName || 'Mahim Dev';
  const profTitle = settings?.professionalTitle || 'Full-Stack Developer';
  const socialLinks = (settings?.socialLinks || []).filter((s) => s.visible !== false);

  return (
    <div className="min-h-screen flex flex-col bg-[#030514] text-[#F5F5FF] relative overflow-x-clip">
      {/* Subtle ambient cosmic radial lighting */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      >
        <div className="absolute -top-40 -left-32 w-[520px] h-[520px] rounded-full bg-[#8B19FF]/12 blur-[130px]" />
        <div className="absolute top-1/4 -right-40 w-[560px] h-[560px] rounded-full bg-[#087BFF]/12 blur-[140px]" />
      </div>

      {/* Top Navigation Bar matching Homepage Reference Image */}
      <header className="sticky top-0 z-40 bg-[#030514]/82 backdrop-blur-xl border-b border-white/[0.07]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-8 py-3.5">
          {/* Zone 1: Developer Brand */}
          <BrandLogo
            name={devName}
            subtitle={profTitle}
            logoUrl={settings?.logoUrl}
          />

          {/* Zone 2: Desktop Navigation Links */}
          <nav
            aria-label="Primary Navigation"
            className="hidden md:flex items-center gap-2 lg:gap-3"
          >
            {PUBLIC_NAV_ITEMS.map((item) => {
              const isActive =
                item.to === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.to);

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-gradient-to-r from-[#5B21B6] to-[#3B0764] text-white border border-[#8B19FF]/60 shadow-[0_0_20px_rgba(139,25,255,0.38)]'
                      : 'text-[#B5BCD9] hover:text-white'
                  }`}
                >
                  {item.showHomeIcon && isActive && (
                    <Home className="w-3.5 h-3.5 text-[#00D9FF]" />
                  )}
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Zone 3: Admin Dashboard Action + Mobile Drawer Toggle */}
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/admin"
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold text-[#F5F5FF] bg-[#090E2C]/90 border border-[#8B19FF]/45 hover:border-[#00D9FF] hover:shadow-[0_0_20px_rgba(139,25,255,0.35)] transition-all whitespace-nowrap shrink-0"
            >
              <Shield className="w-3.5 h-3.5 text-[#A855F7]" />
              <span>Admin Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#B5BCD9]" />
            </Link>

            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileOpen}
              className="md:hidden w-10 h-10 rounded-xl bg-[#090E2C] border border-white/15 flex items-center justify-center text-[#F5F5FF]"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Responsive Mobile Menu */}
        {mobileOpen && (
          <div className="md:hidden bg-[#070B24]/98 border-b border-[#8B19FF]/25 px-4 pt-3 pb-5 space-y-2">
            {PUBLIC_NAV_ITEMS.map((item) => {
              const isActive =
                item.to === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.to);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium ${
                    isActive
                      ? 'bg-[#8B19FF]/25 text-white border border-[#8B19FF]/45'
                      : 'text-[#B5BCD9] hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span>{item.label}</span>
                  <ArrowRight className="w-4 h-4 opacity-60" />
                </NavLink>
              );
            })}
            <Link
              to="/admin"
              onClick={() => setMobileOpen(false)}
              className="mt-2 flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-sm font-semibold text-white btn-neon-primary"
            >
              <Shield className="w-4 h-4" />
              <span>Admin Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </header>

      {/* Main Route Viewport */}
      <main className="relative z-10 flex-1">
        <Outlet />
      </main>

      {/* Footer matching Homepage Reference Image */}
      <footer className="relative z-10 bg-[#04071A] border-t border-white/[0.08] pt-10 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-white/[0.08]">
            <BrandLogo
              name={devName}
              subtitle={profTitle}
              logoUrl={settings?.logoUrl}
            />

            <nav aria-label="Footer Navigation" className="flex flex-wrap items-center justify-center gap-6 text-sm text-[#B5BCD9]">
              {PUBLIC_NAV_ITEMS.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="hover:text-white transition-colors whitespace-nowrap"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-2.5">
              {socialLinks.map((social, idx) => (
                <a
                  key={social._id || idx}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label || social.platform}
                  className="w-9 h-9 rounded-full bg-[#090E2C] border border-white/12 flex items-center justify-center text-[#B5BCD9] hover:text-white hover:border-[#8B19FF] transition-colors"
                >
                  <DynamicIcon name={social.icon || social.platform} className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#B5BCD9]/80">
            <p>{settings?.copyrightText || '© 2025 Mahim Dev. All rights reserved.'}</p>
            <p>{settings?.builtWithText || 'Built with ❤️ for a better web.'}</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
