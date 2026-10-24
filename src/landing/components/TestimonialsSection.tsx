import { useState } from "react";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";

export function TestimonialsSection() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const testimonials = [
    {
      id: 1,
      quote:
        "RideProfit has made it so easy to track all my vehicles and profits. Highly recommended!",
      name: "Jignesh Patel",
      role: "Transport Business Owner",
      avatar: "/assets/landing/avatar-1.png",
      rating: 5,
    },
    {
      id: 2,
      quote: "Best vehicle management software for transport business. Simple and very useful.",
      name: "Mahesh Solanki",
      role: "Fleet Owner",
      avatar: "/assets/landing/avatar-2.png",
      rating: 5,
    },
    {
      id: 3,
      quote: "Now I can easily track income, expenses and real profit. Great application!",
      name: "Ramesh Gohil",
      role: "Truck Owner",
      avatar: "/assets/landing/avatar-3.png",
      rating: 5,
    },
  ];

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? testimonials.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === testimonials.length - 1 ? 0 : prev + 1));
  };

  return (
    <section id="reviews" className="relative py-20 lg:py-28 overflow-hidden scroll-mt-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header with Carousel Controls */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-14">
          <div>
            <div className="inline-block mb-4">
              <span className="landing-pill-badge">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                TESTIMONIALS
              </span>
            </div>

            <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
              What Our <span className="landing-gradient-text">Users Say</span>
            </h2>
          </div>

          {/* Left / Right Nav Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrev}
              className="grid h-11 w-11 place-items-center rounded-full border border-slate-700 bg-slate-900/80 text-slate-300 hover:border-cyan-400 hover:text-white hover:bg-cyan-500/10 transition-colors"
              aria-label="Previous testimonial"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="grid h-11 w-11 place-items-center rounded-full border border-slate-700 bg-slate-900/80 text-slate-300 hover:border-cyan-400 hover:text-white hover:bg-cyan-500/10 transition-colors"
              aria-label="Next testimonial"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Testimonials Grid (Desktop 3-column, Mobile 1-card Carousel) */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {testimonials.map((t, idx) => {
            const isCurrent = idx === currentIndex;
            return (
              <div
                key={t.id}
                className={`landing-glass-card flex-col justify-between rounded-3xl p-6 sm:p-7 border transition-all duration-300 relative group ${
                  isCurrent
                    ? "flex border-cyan-500/60 shadow-[0_0_30px_rgba(6,182,212,0.15)] ring-1 ring-cyan-400/30"
                    : "hidden md:flex border-slate-800/80 hover:border-cyan-500/40"
                }`}
              >
                <div>
                  {/* 5 Stars */}
                  <div className="flex items-center gap-1 text-cyan-400 mb-4">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-cyan-400 text-cyan-400" />
                    ))}
                  </div>

                  {/* Quote */}
                  <p className="text-sm sm:text-base text-slate-200 leading-relaxed italic">
                    "{t.quote}"
                  </p>
                </div>

                {/* Author Lockup */}
                <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center gap-3.5">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full ring-2 ring-cyan-500/30">
                    <img
                      src={t.avatar}
                      alt={t.name}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                      {t.name}
                    </p>
                    <p className="truncate text-xs font-medium text-slate-400">{t.role}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile carousel indicator dots */}
        <div className="mt-8 flex justify-center items-center gap-2 md:hidden">
          {testimonials.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrentIndex(i)}
              className={`h-2 rounded-full transition-all ${
                currentIndex === i
                  ? "w-7 bg-cyan-400 shadow-[0_0_10px_#22d3ee]"
                  : "w-2 bg-slate-700 hover:bg-slate-500"
              }`}
              aria-label={`Go to testimonial ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
