"use client";

import {useEffect, useMemo, useState} from "react";

type IconKey = "cart" | "search" | "laptop" | "device" | "globe" | "desktop" | "cloud";

type Cell = {
  id: number;
  icon: IconKey;
};

const CELLS: Cell[] = [
  {id: 0, icon: "search"},
  {id: 1, icon: "cart"},
  {id: 2, icon: "laptop"},
  {id: 3, icon: "device"},
  {id: 4, icon: "globe"},
  {id: 5, icon: "desktop"},
  {id: 6, icon: "cloud"}
];

const iconClasses = "h-9 w-9 sm:h-10 sm:w-10";

function Icon({name}: {name: IconKey}) {
  switch (name) {
    case "cart":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClasses}>
          <circle cx="10" cy="19" r="1.6" />
          <circle cx="18" cy="19" r="1.6" />
          <path d="M3.5 4.5h2l2.4 10.2h10.5l2-7.5H7.1" />
        </svg>
      );
    case "search":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClasses}>
          <circle cx="11" cy="11" r="6" />
          <path d="m16 16 4 4" />
        </svg>
      );
    case "laptop":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClasses}>
          <rect x="4" y="6" width="16" height="10" rx="1.5" />
          <path d="M2.5 19h19" />
        </svg>
      );
    case "device":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClasses}>
          <rect x="2.8" y="5" width="8.5" height="14" rx="1.4" />
          <rect x="12.5" y="7.5" width="8.7" height="11" rx="1.2" />
        </svg>
      );
    case "globe":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={iconClasses}>
          <circle cx="12" cy="12" r="6.5" />
          <path d="M5.7 9h12.6M5.7 15h12.6M12 5.5c2 1.8 2.9 3.9 2.9 6.5S14 16.7 12 18.5M12 5.5c-2 1.8-2.9 3.9-2.9 6.5s.9 4.7 2.9 6.5" />
        </svg>
      );
    case "desktop":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClasses}>
          <rect x="3" y="5.5" width="18" height="11" rx="1.5" />
          <path d="M9 20h6M12 16.5V20" />
        </svg>
      );
    case "cloud":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClasses}>
          <path d="M8.7 18.3h8a4 4 0 0 0 .4-8 5.8 5.8 0 0 0-11.1 1.3A3.5 3.5 0 0 0 8.7 18.3Z" />
          <path d="m12 10.4 2.6 2.6M12 10.4 9.4 13M12 10.4v7" />
        </svg>
      );
    default:
      return null;
  }
}

export function LoginAnimatedBackground() {
  const [selectedCell, setSelectedCell] = useState(1);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSelectedCell((previous) => {
        const nextIndexOptions = CELLS.map((cell) => cell.id).filter((id) => id !== previous);
        const randomPosition = Math.floor(Math.random() * nextIndexOptions.length);
        return nextIndexOptions[randomPosition] ?? previous;
      });
    }, 5000);

    return () => window.clearInterval(timer);
  }, []);

  const glowPosition = useMemo(() => {
    const map: Record<number, string> = {
      0: "18% 32%",
      1: "42% 24%",
      2: "67% 34%",
      3: "30% 58%",
      4: "52% 60%",
      5: "74% 58%",
      6: "50% 82%"
    };
    return map[selectedCell] ?? "42% 24%";
  }, [selectedCell]);

  return (
    <div className="login-bg relative h-full w-full overflow-hidden rounded-2xl border border-white/35">
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background: `radial-gradient(circle at ${glowPosition}, rgba(93, 200, 255, 0.42), transparent 24%)`
        }}
      />

      <div className="hex-grid absolute inset-0 px-8 py-10 sm:px-12 sm:py-12">
        {CELLS.map((cell) => {
          const active = selectedCell === cell.id;
          return (
            <div key={cell.id} className={`hex-cell ${active ? "is-active" : ""}`}>
              <span className="icon-wrap">
                <Icon name={cell.icon} />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
