import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Truck,
  ArrowRight,
  Menu,
  X,
  Home,
  Sparkles,
  Workflow,
  Layers,
  IndianRupee,
  HelpCircle,
  LogIn,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LandingNavbarProps {
  activeSection?: string;
}

export function LandingNavbar({ activeSection = "home" }: LandingNavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 15);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const navLinks = [
    { label: "Home", href: "#home", id: "home", icon: Home },
    { label: "Features", href: "#features", id: "features", icon: Sparkles },
    { label: "How It Works", href: "#how-it-works", id: "how-it-works", icon: Workflow },
    { label: "Screenshots", href: "#screenshots", id: "screenshots", icon: Layers },
    { label: "Pricing", href: "#pricing", id: "pricing", icon: IndianRupee },
    { label: "FAQ", href: "#faq", id: "faq", icon: HelpCircle },
  ];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    setMobileOpen(false);

    if (targetId === "home") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      window.history.pushState(null, "", "#home");
      return;
    }

    const element = document.getElementById(targetId);
    if (element) {
      const headerOffset = 85;
      const elementPosition = element.getBoundingClientRect().top + window.scrollY;
      const offsetPosition = elementPosition - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
      window.history.pushState(null, "", `#${targetId}`);
    }
  };

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 w-full transition-all duration-300",
          isScrolled
            ? "border-b border-cyan-500/25 bg-[#030712]/95 backdrop-blur-2xl shadow-[0_4px_30px_rgba(6,182,212,0.14)]"
            : "border-b border-cyan-500/10 bg-[#030712]/85 backdrop-blur-xl",
        )}
      >
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo: Truck icon + wordmark */}
          <a
            href="#home"
            onClick={(e) => handleNavClick(e, "home")}
            className="group flex items-center gap-3 select-none"
          >
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
          <nav className="hidden md:flex items-center gap-1 rounded-full border border-slate-800/90 bg-slate-900/70 p-1.5 backdrop-blur-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
            {navLinks.map((link) => {
              const isActive = activeSection === link.id;
              return (
                <a
                  key={link.id}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.id)}
                  className={cn(
                    "relative px-4 py-2 text-sm font-semibold transition-all duration-200 rounded-full",
                    isActive
                      ? "text-white bg-gradient-to-r from-purple-600/30 to-cyan-500/30 border border-purple-500/40 shadow-[0_0_16px_rgba(168,85,247,0.35)]"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/60",
                  )}
                >
                  {link.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-[2px] bg-cyan-400 rounded-full shadow-[0_0_8px_#22d3ee]" />
                  )}
                </a>
              );
            })}
          </nav>

          {/* Right CTA Actions - Desktop */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/auth"
              className="landing-btn-glass rounded-xl px-5 py-2.5 text-sm font-bold text-slate-200 hover:text-white"
            >
              Login
            </Link>
            <Link
              to="/auth"
              search={{ mode: "register" }}
              className="landing-btn-primary group flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_25px_rgba(6,182,212,0.5)]"
            >
              <span>Get Started</span>
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
          </div>

          {/* Mobile Right Controls: Compact Get Started + Menu Toggle */}
          <div className="flex md:hidden items-center gap-2">
            <Link
              to="/auth"
              search={{ mode: "register" }}
              className="landing-btn-primary flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold shadow-[0_0_15px_rgba(6,182,212,0.35)]"
            >
              <span>Get Started</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/25 bg-slate-900/90 text-slate-200 transition-all hover:border-cyan-400 hover:text-white"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="h-5 w-5 text-cyan-400" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileOpen && (
          <div className="border-b border-cyan-500/25 bg-[#050b16]/98 backdrop-blur-2xl px-4 py-5 md:hidden animate-in fade-in slide-in-from-top-3 duration-200">
            <nav className="flex flex-col gap-1.5">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = activeSection === link.id;
                return (
                  <a
                    key={link.id}
                    href={link.href}
                    onClick={(e) => handleNavClick(e, link.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all",
                      isActive
                        ? "bg-gradient-to-r from-purple-600/25 to-cyan-500/25 border border-cyan-500/35 text-white font-bold shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                        : "text-slate-300 hover:bg-slate-800/70 hover:text-white",
                    )}
                  >
                    <Icon
                      className={cn("h-4 w-4", isActive ? "text-cyan-400" : "text-slate-400")}
                    />
                    <span>{link.label}</span>
                  </a>
                );
              })}

              <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-col gap-2.5">
                <Link
                  to="/auth"
                  onClick={() => setMobileOpen(false)}
                  className="landing-btn-glass flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold"
                >
                  <LogIn className="h-4 w-4 text-slate-400" />
                  <span>Login</span>
                </Link>
                <Link
                  to="/auth"
                  search={{ mode: "register" }}
                  onClick={() => setMobileOpen(false)}
                  className="landing-btn-primary flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold shadow-[0_0_20px_rgba(6,182,212,0.4)]"
                >
                  <span>Get Started Free</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* Backdrop overlay for mobile drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
}
