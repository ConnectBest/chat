"use client";

import { useState } from "react";

type AuthMode = "signIn" | "signUp";

export const AuthScreen = () => {
  const [mode, setMode] = useState<AuthMode>("signIn");

  const title = mode === "signIn" ? "Welcome back" : "Create your account";
  const subtitle =
    mode === "signIn"
      ? "Sign in to join your workspaces and continue where you left off."
      : "Sign up to start collaborating with your team in real time.";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#5C3B58] via-[#5C3B88] to-[#4F46E5]">
      <div className="w-full max-w-md px-4">
        <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl text-white px-8 py-7 space-y-6">
          {/* Header */}
          <div className="space-y-2 text-center">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">
              ConnectBest · Slack clone
            </p>
            <h1 className="text-2xl font-semibold">{title}</h1>
            <p className="text-sm text-white/60">{subtitle}</p>
          </div>

          {/* Switch tabs */}
          <div className="flex items-center justify-center gap-1 bg-white/5 rounded-full p-1 text-xs">
            <button
              type="button"
              onClick={() => setMode("signIn")}
              className={`flex-1 py-2 rounded-full transition ${
                mode === "signIn"
                  ? "bg-white text-black shadow"
                  : "text-white/70 hover:bg-white/10"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode("signUp")}
              className={`flex-1 py-2 rounded-full transition ${
                mode === "signUp"
                  ? "bg-white text-black shadow"
                  : "text-white/70 hover:bg-white/10"
              }`}
            >
              Sign up
            </button>
          </div>

          {/* Card content */}
          <div>
            {mode === "signIn" ? <SignInCard /> : <SignUpCard />}
          </div>

          {/* Footer text */}
          <p className="text-[10px] text-center text-white/40">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * Simple placeholder Sign In form.
 * Your teammate以後可以把這邊換成影片裡完整的UI + 真正的表單邏輯。
 */
const SignInCard = () => {
  return (
    <form className="space-y-4">
      <div className="space-y-1">
        <label className="text-xs text-white/70">Email</label>
        <input
          type="email"
          className="w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
          placeholder="you@example.com"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-white/70">Password</label>
        <input
          type="password"
          className="w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
          placeholder="••••••••"
        />
      </div>
      <button
        type="submit"
        className="w-full rounded-lg bg-indigo-500 hover:bg-indigo-400 text-sm font-medium py-2.5 transition"
      >
        Continue
      </button>
      <button
        type="button"
        className="w-full rounded-lg border border-white/20 bg-transparent hover:bg-white/10 text-sm font-medium py-2.5 transition"
      >
        Continue with GitHub
      </button>
    </form>
  );
};

const SignUpCard = () => {
  return (
    <form className="space-y-4">
      <div className="space-y-1">
        <label className="text-xs text-white/70">Name</label>
        <input
          type="text"
          className="w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
          placeholder="Your name"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-white/70">Email</label>
        <input
          type="email"
          className="w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
          placeholder="you@example.com"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-white/70">Password</label>
        <input
          type="password"
          className="w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
          placeholder="Create a password"
        />
      </div>
      <button
        type="submit"
        className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 text-sm font-medium py-2.5 transition"
      >
        Create account
      </button>
    </form>
  );
};
