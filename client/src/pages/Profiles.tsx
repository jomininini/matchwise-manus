import ProfileCard from "@/components/ProfileCard";
import WorkspaceShell from "@/components/WorkspaceShell";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { AlertCircle, Building2, Loader2, Search, SlidersHorizontal, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

export default function Profiles() {
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("");
  const profileQuery = trpc.profiles.browse.useQuery({ query: query || undefined, sector: sector || undefined, pageSize: 24 });
  const count = profileQuery.data?.total ?? 0;
  return <WorkspaceShell eyebrow="Official HKSTP company directory" title="Company directory" action={<Link href="/company-match" className="hidden sm:inline-flex"><button className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#1d2b5c] px-3.5 text-xs font-bold text-white hover:bg-[#273874]"><Sparkles className="size-3.5" /> Company Match</button></Link>}>
    <section className="rounded-[24px] border border-[#e3e6ee] bg-white p-5 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#8992a7]">{count.toLocaleString()} official company profiles</p><p className="mt-2 max-w-xl text-sm leading-6 text-[#687187]">浏览由 HKSTP 官方 API 导入的公司资料。Company Match 使用同一数据源建立语义向量索引。</p></div><span className="inline-flex w-fit items-center gap-2 rounded-xl bg-[#edf1fc] px-3 py-2 text-xs font-bold text-[#465ba7]"><Building2 className="size-3.5" /> Companies only</span></div><div className="mt-6 grid gap-3 md:grid-cols-[1fr_220px]"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9ca3b5]" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索公司名称、技术、产品或描述" className="h-11 rounded-xl border-[#e0e4ed] bg-[#fbfcfe] pl-10 text-xs shadow-none" /></div><div className="relative"><SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9ca3b5]" /><Input value={sector} onChange={event => setSector(event.target.value)} placeholder="按 HKSTP cluster 筛选" className="h-11 rounded-xl border-[#e0e4ed] bg-[#fbfcfe] pl-10 text-xs shadow-none" /></div></div></section>
    <section className="mt-6">{profileQuery.isLoading ? <div className="grid min-h-72 place-items-center"><Loader2 className="size-6 animate-spin text-[#5063ac]" /></div> : profileQuery.isError ? <div className="grid min-h-64 place-items-center rounded-[22px] border border-dashed border-[#e7d5d5] bg-white text-center"><div><AlertCircle className="mx-auto size-6 text-[#c46a6a]" /><h3 className="mt-3 text-sm font-semibold text-[#4e3d4a]">公司目录无法加载</h3><p className="mt-1 text-xs text-[#877985]">请刷新页面或稍后重试。</p></div></div> : profileQuery.data?.items.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{profileQuery.data.items.map(profile => <ProfileCard key={profile.id} profile={profile} />)}</div> : <div className="grid min-h-64 place-items-center rounded-[22px] border border-dashed border-[#d7dce7] bg-white text-center"><div><Search className="mx-auto size-6 text-[#9ca5bc]" /><h3 className="mt-3 text-sm font-semibold text-[#34405f]">未找到匹配公司</h3><p className="mt-1 text-xs text-[#7e8798]">请尝试更宽泛的关键词或移除 cluster 筛选。</p></div></div>}</section>
  </WorkspaceShell>;
}
