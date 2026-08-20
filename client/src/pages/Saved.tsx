import ProfileCard from "@/components/ProfileCard";
import WorkspaceShell from "@/components/WorkspaceShell";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { AlertCircle, Bookmark, Loader2, Sparkles } from "lucide-react";
import { Link } from "wouter";

export default function Saved() {
  const { user, loading } = useAuth();
  const saved = trpc.saved.list.useQuery(undefined, { enabled: Boolean(user) });
  const profileIds = (saved.data ?? []).filter(item => item.itemType === "profile" && item.profileId).map(item => item.profileId!);
  const profiles = trpc.profiles.byIds.useQuery({ profileIds }, { enabled: profileIds.length > 0 });
  if (!loading && !user) return <WorkspaceShell eyebrow="Personal workspace" title="Saved matches"><div className="grid min-h-[420px] place-items-center rounded-[26px] border border-dashed border-[#d7dce8] bg-white text-center"><div><Bookmark className="mx-auto size-7 text-[#7484be]" /><h2 className="mt-4 text-xl font-semibold tracking-[-0.04em] text-[#27335a]">Save the introductions worth revisiting</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#768096]">Sign in to bookmark profiles and keep compatibility briefs together for later review.</p><Button onClick={() => startLogin()} className="mt-6 h-11 rounded-xl bg-[#1e2f65] px-4 text-xs font-bold text-white hover:bg-[#2a3d7e]">Sign in to continue</Button></div></div></WorkspaceShell>;
  return <WorkspaceShell eyebrow="Personal workspace" title="Saved matches"><section className="rounded-[24px] border border-[#e2e5ef] bg-white p-5 sm:p-6"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8a94a8]">Your watchlist</p><h2 className="mt-2 text-xl font-semibold tracking-[-0.045em] text-[#263155]">Profiles and briefs kept for later review.</h2></section><section className="mt-6">{saved.isLoading || profiles.isLoading ? <div className="grid min-h-64 place-items-center"><Loader2 className="size-6 animate-spin text-[#4f63ad]" /></div> : saved.isError || profiles.isError ? <div className="grid min-h-56 place-items-center rounded-[22px] border border-dashed border-[#eadada] bg-white text-center"><div><AlertCircle className="mx-auto size-6 text-[#c36b6b]" /><p className="mt-3 text-sm font-semibold text-[#554150]">Your saved workspace could not be loaded</p><p className="mt-1 text-xs text-[#8a7984]">Refresh the page to try again.</p></div></div> : <><div className="mb-4 flex items-center justify-between"><h3 className="text-sm font-semibold text-[#394361]">Saved profiles</h3><span className="text-xs text-[#8790a2]">{profiles.data?.length ?? 0} saved</span></div>{profiles.data?.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{profiles.data.map(profile => <ProfileCard key={profile.id} profile={profile} />)}</div> : <div className="grid min-h-56 place-items-center rounded-[22px] border border-dashed border-[#d8dce6] bg-white text-center"><div><Sparkles className="mx-auto size-5 text-[#8998ca]" /><p className="mt-3 text-sm font-semibold text-[#49536d]">Your watchlist is clear</p><Link href="/profiles?type=company" className="mt-2 inline-block text-xs font-bold text-[#4155a2]">Explore the startup directory</Link></div></div>}</>} </section></WorkspaceShell>;
}
