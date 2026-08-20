import { cn } from "@/lib/utils";
import { useLocale } from "@/contexts/LocaleContext";
import {
  Archive,
  ArrowUpRight,
  Bookmark,
  Building2,
  ChevronRight,
  Database,
  LayoutDashboard,
  Menu,
  Network,
  Search,
  ShieldCheck,
  Sparkles,
  X,
  Languages,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-9 place-items-center rounded-xl bg-[#1b2a57] text-white shadow-[0_10px_22px_rgba(27,42,87,0.18)]">
        <Network className="size-4" strokeWidth={2.4} />
      </div>
      {!compact && (
        <div className="leading-none">
          <p className="text-[15px] font-semibold tracking-[-0.04em] text-[#19244a]">Matchwise</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.17em] text-[#7b8499]">HKSTP Intelligence</p>
        </div>
      )}
    </div>
  );
}

export default function WorkspaceShell({
  children,
  eyebrow,
  title,
  action,
}: {
  children: React.ReactNode;
  eyebrow?: string;
  title?: string;
  action?: React.ReactNode;
}) {
  const { t, locale, toggleLocale } = useLocale();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navItems = [
    { icon: LayoutDashboard, label: t.companyMatch, path: "/company-match" },
    { icon: Building2, label: t.companyDirectory, path: "/profiles?type=company" },
    { icon: Bookmark, label: t.saved, path: "/saved" },
  ];

  const navigation = (
    <nav className="flex flex-1 flex-col gap-1">
      <p className="px-3 pb-2 pt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8d94a6]">{t.workspace}</p>
      {navItems.map(item => {
        const active = item.path === "/" ? location === "/" : location.startsWith(item.path.split("?")[0]);
        return (
          <Link key={item.label} href={item.path} onClick={() => setMobileOpen(false)} className={cn("group flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all duration-150", active ? "bg-white text-[#19244a] shadow-[0_8px_22px_rgba(31,45,82,0.08)]" : "text-[#6b748b] hover:bg-white/70 hover:text-[#19244a]")}>
            <item.icon className={cn("size-[17px]", active ? "text-[#32469a]" : "text-[#9ba2b2] group-hover:text-[#32469a]")} strokeWidth={active ? 2.3 : 1.9} />
            <span>{item.label}</span>
            {active && <ChevronRight className="ml-auto size-4 text-[#a0a7b7]" />}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#f7f8fc] text-[#20273a]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[242px] border-r border-[#e5e7ef] bg-[#f0f2f8] px-4 py-5 lg:flex lg:flex-col">
        <BrandMark />
        {navigation}
        <div className="mt-auto rounded-2xl border border-[#e0e4ee] bg-white/80 p-3.5">
          <div className="mb-3 flex items-center gap-2 text-[#53618a]"><Sparkles className="size-3.5" /><span className="text-xs font-semibold">{t.aiReady}</span></div>
          <p className="text-[11px] leading-relaxed text-[#7c8496]">{t.aiReadyCopy}</p>
        </div>
        <Link href="/admin" className={cn("mt-3 flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors", location.startsWith("/admin") ? "bg-[#e8ebf7] text-[#31448f]" : "text-[#7c8493] hover:bg-white hover:text-[#3c4e92]")}>
          <ShieldCheck className="size-4" /> {t.dataManagement}
        </Link>
      </aside>

      <div className="lg:pl-[242px]">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-[#e7e9f0]/80 bg-[#f7f8fc]/88 px-5 backdrop-blur-xl sm:px-8 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <button className="grid size-10 place-items-center rounded-xl border border-[#e4e7ee] bg-white text-[#46516c] lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu className="size-5" /></button>
            <div className="min-w-0">
              {eyebrow && <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8490a8]">{eyebrow}</p>}
              {title && <h1 className="truncate text-lg font-semibold tracking-[-0.035em] text-[#1c2546] sm:text-xl">{title}</h1>}
            </div>
          </div>
          <div className="flex items-center gap-2.5">{action}<button onClick={toggleLocale} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#e3e6ef] bg-white px-3 text-xs font-bold text-[#465379] hover:bg-[#f1f3f9]" aria-label={locale === "zh" ? "Switch to English" : "切换至中文"}><Languages className="size-3.5" />{t.language}</button></div>
        </header>
        <main className="mx-auto w-full max-w-[1520px] px-5 py-7 sm:px-8 lg:px-10 lg:py-9">{children}</main>
      </div>

      {mobileOpen && <div className="fixed inset-0 z-50 bg-[#192244]/30 backdrop-blur-[1px] lg:hidden" onClick={() => setMobileOpen(false)}><aside className="h-full w-[290px] bg-[#f0f2f8] px-4 py-5 shadow-2xl" onClick={event => event.stopPropagation()}><div className="flex items-center justify-between"><BrandMark /><button onClick={() => setMobileOpen(false)} className="grid size-9 place-items-center rounded-xl bg-white text-[#536078]"><X className="size-4" /></button></div>{navigation}</aside></div>}
    </div>
  );
}
