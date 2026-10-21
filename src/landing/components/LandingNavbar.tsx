import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Truck, ArrowRight, Menu, X } from "lucide-react";

interface LandingNavbarProps {
  activeSection?: string;
}

export function LandingNavbar({ activeSection = "home" }: LandingNavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { label: "Home", href: "#home", id: "home" },
    { label: "Features", href: "#features", id: "features" },
    { label: "How It Works", href: "#how-it-works", id: "how-it-works" },
    { label: "Screenshots", href: "#screenshots", id: "screenshots" },
    { label: "Pricing", href: "#pricing", id: "pricing" },
    { label: "FAQ", href: "#faq", id: "faq" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-cyan-500/15 bg-[#030712]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo: Truck icon + wordmark */}
        <a href="#home" className="group flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-400/30 transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_0_20px_rgba(6,182,212,0.5)]">
            <Truck className="h-6 w-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-extrabold tracking-tight text-white flex items-center">
              RideProfit
              <span className="ml-1 inline-block h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
            </span>
            <span className="text-[0.62rem] font-bold uppercase tracking-[0.3em] text-cyan-400/80 -mt-1">
              Tracker
            </span>
          </div>
        </a>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-1 rounded-full border border-slate-800/80 bg-slate-900/60 p-1.5 backdrop-blur-md">
          {navLinks.map((link) => {
            const isActive = activeSection === link.id;
            return (
              <a
                key={link.id}
                href={link.href}
                className={`relative px-4 py-2 text-sm font-semibold transition-all duration-200 rounded-full ${
                  isActive
                    ? "text-white bg-gradient-to-r from-purple-600/30 to-cyan-500/30 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.3)]"
                    : "text-slate-300 hover:text-white hover:bg-slate-800/50"
                }`}
              >
                {link.label}
                {isActive ? (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-[2px] bg-cyan-400 rounded-full shadow-[0_0_6px_#22d3ee]" />
                ) : null}
              </a>
            );
          })}
        </nav>

        {/* Right CTA Actions */}
        <div className="hidden sm:flex items-center gap-3">
          <Link
            to="/auth"
            className="landing-btn-glass rounded-xl px-5 py-2.5 text-sm font-bold text-slate-200 hover:text-white"
          >
            Login
          </Link>
          <Link
            to="/auth"
            search={{ mode: "register" }}
            className="landing-btn-primary group flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold"
          >
            <span>Get Started</span>
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </div>

        {/* Mobile Hamburger Button */}
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex md:hidden h-11 w-11 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/80 text-slate-200"
          aria-label="Toggle navigation menu"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen ? (
        <div className="border-b border-cyan-500/20 bg-[#060c18] px-4 py-6 md:hidden">
          <nav className="flex flex-col gap-2">
            {navLinks.map((link) => (
              <a
                key={link.id}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-xl px-4 py-3 text-base font-semibold text-slate-200 hover:bg-cyan-500/10 hover:text-cyan-400"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-4 pt-4 border-t border-slate-800 flex flex-col gap-3">
              <Link
                to="/auth"
                onClick={() => setMobileOpen(false)}
                className="landing-btn-glass text-center rounded-xl py-3 text-sm font-bold"
              >
                Login
              </Link>
              <Link
                to="/auth"
                search={{ mode: "register" }}
                onClick={() => setMobileOpen(false)}
                className="landing-btn-primary text-center rounded-xl py-3 text-sm font-bold flex items-center justify-center gap-2"
              >
                <span>Get Started</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
