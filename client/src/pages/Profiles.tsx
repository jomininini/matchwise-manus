import ProfileCard from "@/components/ProfileCard";
import WorkspaceShell from "@/components/WorkspaceShell";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useLocale } from "@/contexts/LocaleContext";
import { AlertCircle, Building2, Loader2, Search, SlidersHorizontal, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

export default function Profiles() {
  const { locale, t } = useLocale();
  const zh = locale === "zh";
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("");
  const profileQuery = trpc.profiles.browse.useQuery({ query: query || undefined, sector: sector || undefined, pageSize: 24 });
  const count = profileQuery.data?.total ?? 0;
  return <WorkspaceShell eyebrow={t.officialDirectory} title={t.companyDirectory} action={<Link href="/company-match" className="hidden sm:inline-flex"><button className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#1d2b5c] px-3.5 text-xs font-bold text-white hover:bg-[#273874]"><Sparkles className="size-3.5" /> {t.companyMatch}</button></Link>}>
    <section className="rounded-[24px] border border-[#e3e6ee] bg-white p-5 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#8992a7]">{count.toLocaleString()} {zh ? "家官方公司资料" : "official company profiles"}</p><p className="mt-2 max-w-xl text-sm leading-6 text-[#687187]">{zh ? "浏览由 HKSTP 官方 API 导入的公司资料。Company Match 使用同一数据源建立语义向量索引。" : "Browse company records imported from the official HKSTP API. Company Match builds its semantic index from this same source."}</p></div><span className="inline-flex w-fit items-center gap-2 rounded-xl bg-[#edf1fc] px-3 py-2 text-xs font-bold text-[#465ba7]"><Building2 className="size-3.5" /> {zh ? "仅公司资料" : "Companies only"}</span></div><div className="mt-6 grid gap-3 md:grid-cols-[1fr_220px]"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9ca3b5]" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder={zh ? "搜索公司名称、技术、产品或描述" : "Search names, technologies, products, or descriptions"} className="h-11 rounded-xl border-[#e0e4ed] bg-[#fbfcfe] pl-10 text-xs shadow-none" /></div><div className="relative"><SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9ca3b5]" /><Input value={sector} onChange={event => setSector(event.target.value)} placeholder={zh ? "按 HKSTP cluster 筛选" : "Filter by HKSTP cluster"} className="h-11 rounded-xl border-[#e0e4ed] bg-[#fbfcfe] pl-10 text-xs shadow-none" /></div></div></section>
    <section className="mt-6">{profileQuery.isLoading ? <div className="grid min-h-72 place-items-center"><Loader2 className="size-6 animate-spin text-[#5063ac]" /></div> : profileQuery.isError ? <div className="grid min-h-64 place-items-center rounded-[22px] border border-dashed border-[#e7d5d5] bg-white text-center"><div><AlertCircle className="mx-auto size-6 text-[#c46a6a]" /><h3 className="mt-3 text-sm font-semibold text-[#4e3d4a]">{zh ? "公司目录无法加载" : "The company directory could not load"}</h3><p className="mt-1 text-xs text-[#877985]">{zh ? "请刷新页面或稍后重试。" : "Refresh the page or try again shortly."}</p></div></div> : profileQuery.data?.items.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{profileQuery.data.items.map(profile => <ProfileCard key={profile.id} profile={profile} />)}</div> : <div className="grid min-h-64 place-items-center rounded-[22px] border border-dashed border-[#d7dce7] bg-white text-center"><div><Search className="mx-auto size-6 text-[#9ca5bc]" /><h3 className="mt-3 text-sm font-semibold text-[#34405f]">{zh ? "未找到匹配公司" : "No companies found"}</h3><p className="mt-1 text-xs text-[#7e8798]">{zh ? "请尝试更宽泛的关键词或移除 cluster 筛选。" : "Try broader keywords or remove the cluster filter."}</p></div></div>}</section>
  </WorkspaceShell>;
}
