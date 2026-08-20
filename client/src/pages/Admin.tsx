import WorkspaceShell from "@/components/WorkspaceShell";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { AlertCircle, CheckCircle2, Database, FileUp, Loader2, ShieldCheck, Upload } from "lucide-react";
import { ChangeEvent, useState } from "react";
import { toast } from "sonner";

type DatasetType = "company" | "solution" | "investor";
const datasetCards: { sourceType: DatasetType; title: string; copy: string; source: string }[] = [
  { sourceType: "company", title: "HKSTP company directory", copy: "Replace the startup and company source used by browsing and investor matching.", source: "hkstp_company_directory.csv" },
  { sourceType: "solution", title: "Solution library", copy: "Refresh the solution catalogue used for discovery and smart search.", source: "2_solutions.csv" },
  { sourceType: "investor", title: "Investor directory", copy: "Replace the capital profiles used for matching companies and solutions.", source: "3_investor.csv" },
];

export default function Admin() {
  const { user, loading } = useAuth();
  const owner = Boolean(user?.role === "admin");
  const imports = trpc.admin.imports.useQuery(undefined, { enabled: owner });
  const utils = trpc.useUtils();
  const [uploading, setUploading] = useState<DatasetType | null>(null);
  const importer = trpc.admin.importCsv.useMutation({ onSuccess: async result => { toast.success(`Dataset refreshed with ${result.recordCount.toLocaleString()} records.`); await utils.profiles.counts.invalidate(); await utils.admin.imports.invalidate(); }, onError: error => toast.error(error.message), onSettled: () => setUploading(null) });

  const upload = async (event: ChangeEvent<HTMLInputElement>, sourceType: DatasetType) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) { toast.error("Please select a CSV file."); return; }
    setUploading(sourceType);
    const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error("The file could not be read.")); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(file); });
    importer.mutate({ sourceType, fileName: file.name, base64Csv: dataUrl.split(",")[1] ?? "" });
    event.target.value = "";
  };

  if (!loading && !user) return <WorkspaceShell eyebrow="Owner controls" title="Dataset administration"><AccessState onSignIn={() => startLogin()} /></WorkspaceShell>;
  if (!loading && !owner) return <WorkspaceShell eyebrow="Owner controls" title="Dataset administration"><div className="grid min-h-[430px] place-items-center rounded-[26px] border border-dashed border-[#d8dce7] bg-white text-center"><div><ShieldCheck className="mx-auto size-7 text-[#9ba5bd]" /><h2 className="mt-4 text-lg font-semibold tracking-[-0.04em] text-[#313b5c]">Owner access required</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#798197]">Only the project owner can upload or replace the source datasets powering Matchwise.</p></div></div></WorkspaceShell>;
  return <WorkspaceShell eyebrow="Owner controls" title="Dataset administration"><section className="rounded-[24px] border border-[#dfe4f0] bg-[#1d2b5b] p-6 text-white sm:p-7"><div className="flex items-start gap-4"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 text-[#dce4ff]"><Database className="size-5" /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#afbee8]">Controlled data refresh</p><h2 className="mt-1 text-xl font-semibold tracking-[-0.045em]">Keep the matching workspace current.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-[#c4ceed]">Uploading a CSV securely stores the source file and replaces only the matching dataset type. Existing profiles in the other directories remain intact.</p></div></div></section><section className="mt-6 grid gap-4 xl:grid-cols-3">{datasetCards.map(card => <div key={card.sourceType} className="rounded-[22px] border border-[#e2e5ee] bg-white p-5"><span className="grid size-9 place-items-center rounded-xl bg-[#edf0fb] text-[#4c61ad]"><FileUp className="size-4" /></span><h3 className="mt-4 text-sm font-semibold text-[#33405f]">{card.title}</h3><p className="mt-2 min-h-10 text-xs leading-5 text-[#788197]">{card.copy}</p><p className="mt-4 rounded-lg bg-[#f5f6fa] px-2.5 py-2 font-mono text-[10px] text-[#697287]">Expected: {card.source}</p><label className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#eef1fb] px-3 text-xs font-bold text-[#4257a4] transition-colors hover:bg-[#e2e7f8]"><Upload className="size-3.5" />{uploading === card.sourceType ? "Importing…" : "Upload CSV"}<input type="file" accept=".csv,text/csv" className="sr-only" disabled={uploading !== null} onChange={event => upload(event, card.sourceType)} /></label></div>)}</section><section className="mt-7 rounded-[22px] border border-[#e1e5ee] bg-white"><div className="flex items-center justify-between border-b border-[#e9ecf2] px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#8a94a8]">Import history</p><h3 className="mt-1 text-sm font-semibold text-[#36405e]">Recent dataset events</h3></div></div>{imports.isLoading ? <div className="grid min-h-32 place-items-center"><Loader2 className="size-5 animate-spin text-[#5366ad]" /></div> : imports.isError ? <div className="p-7 text-center text-xs text-[#a16060]">Import history could not be loaded. Refresh the page to try again.</div> : imports.data?.length ? <div className="divide-y divide-[#edf0f4]">{imports.data.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div><p className="text-xs font-semibold capitalize text-[#3d4762]">{item.sourceType} · {item.fileName}</p><p className="mt-1 text-[11px] text-[#7c8597]">{new Date(item.createdAt).toLocaleString()} · {item.recordCount.toLocaleString()} records</p></div><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${item.status === "ready" ? "bg-[#edf7f0] text-[#3b8a59]" : item.status === "failed" ? "bg-[#fff0f0] text-[#b65656]" : "bg-[#eff2fb] text-[#5568ae]"}`}>{item.status === "ready" ? <CheckCircle2 className="size-3" /> : <AlertCircle className="size-3" />}{item.status}</span></div>)}</div> : <div className="p-7 text-center text-xs text-[#8790a1]">No import records are available.</div>}</section></WorkspaceShell>;
}

function AccessState({ onSignIn }: { onSignIn: () => void }) { return <div className="grid min-h-[430px] place-items-center rounded-[26px] border border-dashed border-[#d8dce7] bg-white text-center"><div><ShieldCheck className="mx-auto size-7 text-[#7a8bc1]" /><h2 className="mt-4 text-lg font-semibold tracking-[-0.04em] text-[#313b5c]">Sign in to verify access</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#798197]">Dataset operations are limited to the project owner.</p><Button onClick={onSignIn} className="mt-6 h-11 rounded-xl bg-[#1e2f65] px-4 text-xs font-bold text-white hover:bg-[#2a3d7e]">Sign in</Button></div></div>; }
