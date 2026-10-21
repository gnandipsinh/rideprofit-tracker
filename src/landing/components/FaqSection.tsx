import { useState } from "react";
import { ChevronDown } from "lucide-react";

export function FaqSection() {
  const [openIds, setOpenIds] = useState<number[]>([1]);

  const faqs = [
    {
      id: 1,
      question: "Is RideProfit free to use?",
      answer:
        "Yes, RideProfit offers a free plan designed for transport operators and single-truck owners to start recording trips, tracking diesel expenses, and calculating real net profit right away.",
    },
    {
      id: 2,
      question: "Can I add multiple vehicles?",
      answer:
        "Absolutely! You can add unlimited trucks, tippers, trailers, and delivery vans with custom vehicle numbers, ownership details, and separate financial records for each vehicle.",
    },
    {
      id: 3,
      question: "Can I track all types of expenses?",
      answer:
        "Yes. Track primary diesel costs, driver payments, and monthly EMI shares, plus custom itemized other expenses such as tolls, parking, challans, loading/unloading, maintenance, and tyre repairs.",
    },
    {
      id: 4,
      question: "Is my data safe and private?",
      answer:
        "Your data is isolated to your private account and protected with modern encrypted JWT authentication, secure database storage, and rate limiting against unauthorized access.",
    },
    {
      id: 5,
      question: "How do I download monthly PDF reports?",
      answer:
        "Navigate to the Reports tab, select your vehicle and date range (Today, This Month, Custom), and click 'Download PDF' for a professional breakdown report ready to share with accountants or partners.",
    },
    {
      id: 6,
      question: "Can I install it on my phone?",
      answer:
        "Yes! RideProfit Tracker is a Progressive Web App (PWA). You can click 'Install App' directly in your browser to add it to your Android or iPhone home screen with offline support.",
    },
  ];

  const toggle = (id: number) => {
    setOpenIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  return (
    <section id="faq" className="relative py-20 lg:py-28 overflow-hidden bg-[#02050c] scroll-mt-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-left sm:text-center max-w-3xl mx-auto mb-14">
          <div className="inline-block mb-4">
            <span className="landing-pill-badge">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
              FAQ
            </span>
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Frequently Asked <span className="landing-gradient-text">Questions</span>
          </h2>
        </div>

        {/* 2-Column FAQ Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 max-w-5xl mx-auto">
          {faqs.map((faq) => {
            const isOpen = openIds.includes(faq.id);
            return (
              <div
                key={faq.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-md overflow-hidden transition-all duration-200 hover:border-cyan-500/30"
              >
                <button
                  type="button"
                  onClick={() => toggle(faq.id)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${faq.id}`}
                  className="flex w-full items-center justify-between gap-4 p-5 text-left text-sm sm:text-base font-bold text-white transition-colors hover:text-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none rounded-2xl"
                >
                  <span>{faq.question}</span>
                  <div
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-800 text-slate-300 transition-transform duration-200 ${
                      isOpen ? "rotate-180 text-cyan-400 bg-cyan-500/15" : ""
                    }`}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </button>

                {isOpen ? (
                  <div
                    id={`faq-answer-${faq.id}`}
                    role="region"
                    className="px-5 pb-5 pt-1 text-xs sm:text-sm text-slate-300 leading-relaxed border-t border-slate-800/60"
                  >
                    {faq.answer}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
