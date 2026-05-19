"use client";

import Image from "next/image";
import {useEffect, useState} from "react";

type Slide = {
  title: string;
  text: string;
  image: string;
};

type LoginShowcaseProps = {
  slides: Slide[];
};

export function LoginShowcase({slides}: LoginShowcaseProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;

    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [slides.length]);

  return (
    <section className="relative z-10 grid h-full w-full grid-rows-[minmax(0,1fr)_170px] rounded-3xl border border-white/20 bg-white/12 p-4 shadow-[0_12px_40px_rgba(8,38,78,0.1)] backdrop-blur-lg sm:grid-rows-[minmax(0,1fr)_190px] sm:p-6 lg:p-7">
      <div className="relative min-h-0 overflow-hidden rounded-2xl border border-white/28 bg-slate-100/12 shadow-inner">
        {slides.map((slide, index) => {
          const isActive = index === activeIndex;
          return (
            <div
              key={slide.image}
              className={`absolute inset-0 transition-opacity duration-1000 motion-reduce:transition-none ${isActive ? "opacity-100" : "opacity-0"}`}
            >
              <Image
                src={slide.image}
                alt={slide.title}
                fill
                sizes="(max-width: 1024px) 100vw, 55vw"
                className="object-cover opacity-80"
                priority={index === 0}
              />
            </div>
          );
        })}
      </div>

      <div className="relative mt-4 min-h-0">
        {slides.map((slide, index) => {
          const isActive = index === activeIndex;
          return (
            <article
              key={`${slide.title}-${index}`}
              className={`absolute inset-0 rounded-xl border border-white/25 bg-white/10 p-3 backdrop-blur-lg transition-all duration-700 motion-reduce:transition-none sm:p-4 ${
                isActive
                  ? "translate-y-0 opacity-100 shadow-[0_12px_24px_rgba(18,57,95,0.18)]"
                  : "pointer-events-none translate-y-2 opacity-0"
              }`}
            >
              <h3 className="text-base font-semibold text-slate-900 sm:text-lg">{slide.title}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-700">{slide.text}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
