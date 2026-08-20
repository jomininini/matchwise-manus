import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { Bookmark, Building2, ExternalLink, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type Profile = { id: string; sourceType: "company" | "solution" | "investor"; name: string; sector: string | null; stage: string | null; technology: string | null; description: string | null; investmentFocus: string | null; ticketSize: string | null; portfolio: string | null; website: string | null };

function clip(value?: string | null, length = 180) { if (!value) return "官方目录资料尚待进一步补充。"; return value.length > length ? `${value.slice(0, length).trim()}…` : value; }

export default function ProfileCard({ profile, compact = false, score, explanation }: { profile: Profile; compact?: boolean; score?: number; explanation?: string }) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const toggleSaved = trpc.profiles.toggleSaved.useMutation({ onSuccess: result => { setSaved(result.saved); toast.success(result.saved ? "已加入收藏" : "已移除收藏"); }, onError: error => toast.error(error.message) });
  const save = () => { if (!user) { startLogin(); return; } toggleSaved.mutate({ profileId: profile.id }); };
  return <article className={cn("group relative flex flex-col overflow-hidden rounded-[22px] border border-[#e4e7ef] bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#cfd5e7] hover:shadow-[0_18px_45px_rgba(30,42,78,0.09)]", compact ? "min-h-[280px]" : "min-h-[336px]")}><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#eaf0fb] text-[#344a9e]"><Building2 className="size-5" /></div><div className="min-w-0"><p className="truncate text-sm font-semibold tracking-[-0.025em] text-[#202a4c]">{profile.name}</p><p className="mt-0.5 text-[11px] font-medium text-[#8b93a5]">HKSTP company</p></div></div><button onClick={save} aria-label="收藏公司" className={cn("grid size-8 place-items-center rounded-lg border transition-colors", saved ? "border-[#d9ddf0] bg-[#eef0fb] text-[#3f54a4]" : "border-[#edf0f4] text-[#a4abbb] hover:border-[#d6daea] hover:text-[#4253a0]")}><Bookmark className={cn("size-3.5", saved && "fill-current")} /></button></div><div className="mt-4 flex flex-wrap gap-1.5">{(profile.sector || profile.technology) && <span className="max-w-full truncate rounded-md bg-[#f3f5f9] px-2 py-1 text-[10px] font-semibold text-[#626c83]">{profile.sector || profile.technology}</span>}</div><p className="mt-4 text-[12px] leading-[1.65] text-[#687187]">{clip(profile.description || profile.technology, compact ? 140 : 215)}</p>{score !== undefined && <div className="mt-4 rounded-xl bg-[#f0f3fb] p-3"><div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#6d78a5]">匹配分数</span><span className="text-sm font-bold tracking-[-0.03em] text-[#263b88]">{score}%</span></div>{explanation && <p className="mt-2 text-[11px] leading-relaxed text-[#5e6881]">{explanation}</p>}</div>}<div className="mt-auto flex items-center justify-between pt-5"><button onClick={() => setLocation("/company-match")} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#33489b] hover:text-[#1e3176]"><Sparkles className="size-3.5" /> Company Match</button>{profile.website && <a href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`} target="_blank" rel="noreferrer" className="grid size-8 place-items-center rounded-lg text-[#8f97aa] transition-colors hover:bg-[#f4f6fa] hover:text-[#354b9e]" aria-label="访问公司网站"><ExternalLink className="size-3.5" /></a>}</div></article>;
}
