import { Truck, MessageCircle, Mail } from "lucide-react";

export function LandingFooter() {
  const links = [
    { label: "Home", href: "#home" },
    { label: "Features", href: "#features" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "Screenshots", href: "#screenshots" },
    { label: "Pricing", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
    { label: "Login", href: "/auth" },
  ];

  return (
    <footer className="border-t border-slate-800/80 bg-[#02050c] py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 pb-8 border-b border-slate-800/60">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-400/30">
              <Truck className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-extrabold tracking-tight text-white flex items-center">
                RideProfit
                <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-cyan-400" />
              </span>
              <span className="text-[0.58rem] font-bold uppercase tracking-[0.28em] text-cyan-400/80 -mt-1">
                Tracker
              </span>
            </div>
          </div>

          {/* Links */}
          <nav className="flex flex-wrap items-center justify-center gap-6 text-xs sm:text-sm font-semibold text-slate-400">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="hover:text-cyan-400 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Contact / Help Actions */}
          <div className="flex items-center gap-3">
            <a
              href="https://wa.me/?text=Hello%20RideProfit%20Tracker"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-cyan-400 hover:border-cyan-500/40 transition-colors"
              aria-label="Contact via WhatsApp"
            >
              <MessageCircle className="h-4 w-4 text-emerald-400" />
              <span>WhatsApp</span>
            </a>
            <a
              href="mailto:support@rideprofit.app"
              className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-cyan-400 hover:border-cyan-500/40 transition-colors"
              aria-label="Email Support"
            >
              <Mail className="h-4 w-4 text-cyan-400" />
              <span>Email Support</span>
            </a>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 text-center text-xs text-slate-500">
          <p>© 2026 RideProfit Tracker. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
