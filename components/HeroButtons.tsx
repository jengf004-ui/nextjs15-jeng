"use client";

import { ArrowRight } from "lucide-react";

export function HeroButtons() {
  const handleClick = (href: string) => {
    window.open(href, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
      <button
        onClick={() => handleClick("https://nextjs.org/docs")}
        className="group inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30 hover:brightness-110 cursor-pointer"
      >
        Get Started
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </button>
      <button
        onClick={() => handleClick("https://github.com/vercel/next.js")}
        className="inline-flex h-12 items-center gap-2 rounded-xl border border-border bg-background px-6 text-sm font-semibold transition-colors hover:bg-accent cursor-pointer"
      >
        View on GitHub
      </button>
    </div>
  );
}
