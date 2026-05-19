"use client";

import {signIn} from "next-auth/react";

type SocialAuthButtonsProps = {
  locale: string;
  googleLabel: string;
  facebookLabel: string;
  linkedInLabel: string;
  disclaimer: string;
};

export function SocialAuthButtons({
  locale,
  googleLabel,
  facebookLabel,
  linkedInLabel,
  disclaimer
}: SocialAuthButtonsProps) {
  const callbackUrl = `/${locale}`;

  return (
    <div className="mt-5 space-y-3 lg:mt-6 lg:space-y-4">
      <button
        type="button"
        onClick={() => signIn("google", {callbackUrl})}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/45 bg-white/18 text-sm font-semibold text-white transition hover:bg-white/28 lg:h-11"
      >
        <span aria-hidden="true">G</span>
        {googleLabel}
      </button>

      <button
        type="button"
        onClick={() => signIn("facebook", {callbackUrl})}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/45 bg-white/18 text-sm font-semibold text-white transition hover:bg-white/28 lg:h-11"
      >
        <span aria-hidden="true">f</span>
        {facebookLabel}
      </button>

      <button
        type="button"
        onClick={() => signIn("linkedin", {callbackUrl})}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/45 bg-white/18 text-sm font-semibold text-white transition hover:bg-white/28 lg:h-11"
      >
        <span aria-hidden="true">in</span>
        {linkedInLabel}
      </button>

      <p className="pt-1 text-center text-xs text-slate-100/90">{disclaimer}</p>
    </div>
  );
}
