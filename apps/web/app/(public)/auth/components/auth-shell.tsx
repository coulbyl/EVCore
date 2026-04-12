import type { ReactNode } from "react";

export function AuthShell({
  title,
  subtitle,
  children,
  asideTitle,
  asideText,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  asideTitle: string;
  asideText: string;
}) {
  return (
    <main className="min-h-dvh bg-slate-100 px-4 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto grid min-h-[calc(100dvh-2rem)] max-w-6xl overflow-hidden rounded-[1.6rem] border border-border bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)] lg:grid-cols-[minmax(0,1.05fr)_420px]">
        <section className="flex flex-col justify-between bg-[linear-gradient(180deg,#162235_0%,#1d2d45_100%)] px-6 py-8 text-white sm:px-8 sm:py-10">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-cyan-200">
              EVCore
            </p>
            <h1 className="mt-5 max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
              {asideTitle}
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-7 text-slate-300 sm:text-base">
              {asideText}
            </p>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              ["Session", "httpOnly"],
              ["Source", "backend unique"],
              ["Produit", "bets simples"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-lg border border-white/10 bg-white/6 px-4 py-3"
              >
                <p className="text-[0.62rem] uppercase tracking-[0.18em] text-slate-400">
                  {label}
                </p>
                <p className="mt-1 text-sm font-semibold text-white">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col justify-center px-5 py-8 sm:px-8">
          <div className="mx-auto w-full max-w-sm">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-slate-400">
              Authentification
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</p>
            <div className="mt-8">{children}</div>
          </div>
        </section>
      </div>
    </main>
  );
}
