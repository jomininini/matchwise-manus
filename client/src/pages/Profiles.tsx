import ProfileCard from "@/components/ProfileCard";
import WorkspaceShell from "@/components/WorkspaceShell";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { AlertCircle, Building2, CircleDollarSign, Loader2, Search, SlidersHorizontal, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link, useSearch } from "wouter";

type BrowseType = "company" | "solution" | "investor";

function typeFromSearch(search: string): BrowseType {
  const value = new URLSearchParams(search).get("type");
  return value === "investor" || value === "solution" ? value : "company";
}

export default function Profiles() {
  const search = useSearch();
  const type = typeFromSearch(search);
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("");
  const profileQuery = trpc.profiles.browse.useQuery({ sourceType: type, query: query || undefined, sector: sector || undefined, pageSize: 24 });
  const heading = type === "investor" ? "Investor network" : type === "solution" ? "Solution library" : "Startup directory";
  const description = type === "investor" ? "Explore investor profiles from the supplied dataset and turn mandate signals into sharper introductions." : type === "solution" ? "Discover applied solutions catalogued in the supplied source data." : "Explore HKSTP company profiles and surface the ventures worth a deeper conversation.";
  const count = profileQuery.data?.total ?? 0;
  return (
    <WorkspaceShell eyebrow="Directory" title={heading} action={<Link href="/match" className="hidden sm:inline-flex"><button className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#1d2b5c] px-3.5 text-xs font-bold text-white hover:bg-[#273874]"><Sparkles className="size-3.5" /> Smart search</button></Link>}>
      <section className="rounded-[24px] border border-[#e3e6ee] bg-white p-5 sm:p-6"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8992a7]">{count.toLocaleString()} active profiles</p><p className="mt-2 max-w-xl text-sm leading-6 text-[#687187]">{description}</p></div><div className="flex rounded-xl bg-[#f3f5f9] p-1 text-xs font-semibold">{([{ type: "company", label: "Startups", icon: Building2 }, { type: "solution", label: "Solutions", icon: Sparkles }, { type: "investor", label: "Investors", icon: CircleDollarSign }] as const).map(item => <Link key={item.type} href={`/profiles?type=${item.type}`} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 transition-colors ${item.type === type ? "bg-white text-[#24386c] shadow-sm" : "text-[#7d8699] hover:text-[#4b5570]"}`}><item.icon className="size-3.5" />{item.label}</Link>)}</div></div>
        <div className="mt-6 grid gap-3 md:grid-cols-[1fr_220px]"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9ca3b5]" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search ${type === "company" ? "startup names, sectors, or technology" : type === "investor" ? "investor name or focus" : "solutions or institutes"}`} className="h-11 rounded-xl border-[#e0e4ed] bg-[#fbfcfe] pl-10 text-xs shadow-none placeholder:text-[#a8afbd] focus-visible:ring-[#7889ca]" /></div><div className="relative"><SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9ca3b5]" /><Input value={sector} onChange={event => setSector(event.target.value)} placeholder={type === "investor" ? "Focus area" : "Sector or institute"} className="h-11 rounded-xl border-[#e0e4ed] bg-[#fbfcfe] pl-10 text-xs shadow-none placeholder:text-[#a8afbd] focus-visible:ring-[#7889ca]" /></div></div>
      </section>
      <section className="mt-6">{profileQuery.isLoading ? <div className="grid min-h-72 place-items-center"><Loader2 className="size-6 animate-spin text-[#5063ac]" /></div> : profileQuery.isError ? <div className="grid min-h-64 place-items-center rounded-[22px] border border-dashed border-[#e7d5d5] bg-white text-center"><div><AlertCircle className="mx-auto size-6 text-[#c46a6a]" /><h3 className="mt-3 text-sm font-semibold text-[#4e3d4a]">The directory could not be loaded</h3><p className="mt-1 text-xs text-[#877985]">Please refresh the page or try again in a moment.</p></div></div> : profileQuery.data?.items.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{profileQuery.data.items.map(profile => <ProfileCard key={profile.id} profile={profile} />)}</div> : <div className="grid min-h-64 place-items-center rounded-[22px] border border-dashed border-[#d7dce7] bg-white text-center"><div><Search className="mx-auto size-6 text-[#9ca5bc]" /><h3 className="mt-3 text-sm font-semibold text-[#34405f]">No matching profiles found</h3><p className="mt-1 text-xs text-[#7e8798]">Try a broader phrase or remove the sector filter.</p></div></div>}</section>
    </WorkspaceShell>
  );
}
