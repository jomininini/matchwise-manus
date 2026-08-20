import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Locale = "zh" | "en";

export const dictionary = {
  zh: {
    workspace: "工作区", companyMatch: "公司匹配", companyDirectory: "公司目录", saved: "已收藏", dataManagement: "数据管理", aiReady: "AI 匹配已就绪", aiReadyCopy: "基于当前 HKSTP 官方公司数据的排序推荐。", signIn: "登录", signOut: "退出登录", language: "English", officialDirectory: "官方 HKSTP 公司目录",
    stepRefine: "1. 优化需求", stepRecall: "2. 相似度召回", stepAnalyze: "3. AI 逐条分析", stepExport: "4. 导出结果",
    refine: "优化 statement", recall: "执行召回", analyze: "开始 AI 分析", export: "导出 CSV", topK: "召回数量", candidate: "候选公司", matches: "已验证匹配", dataSource: "数据来源", updateVector: "更新向量", enrich: "AI 补全", apply: "应用草案", edit: "编辑", save: "保存", cancel: "取消", refresh: "刷新官方数据", preview: "CSV 预览", activities: "治理记录", noData: "暂无数据", processing: "处理中…", selected: "已选择", languageCode: "中文",
  },
  en: {
    workspace: "Workspace", companyMatch: "Company Match", companyDirectory: "Company Directory", saved: "Saved", dataManagement: "Data Management", aiReady: "AI matching ready", aiReadyCopy: "Ranked recommendations grounded in the active HKSTP company data.", signIn: "Sign in", signOut: "Sign out", language: "中文", officialDirectory: "Official HKSTP Company Directory",
    stepRefine: "1. Refine request", stepRecall: "2. Similarity recall", stepAnalyze: "3. AI analysis", stepExport: "4. Export results",
    refine: "Refine statement", recall: "Run recall", analyze: "Start AI analysis", export: "Export CSV", topK: "Recall size", candidate: "Candidate companies", matches: "Validated matches", dataSource: "Data source", updateVector: "Update vectors", enrich: "AI enrich", apply: "Apply draft", edit: "Edit", save: "Save", cancel: "Cancel", refresh: "Refresh official data", preview: "CSV preview", activities: "Governance log", noData: "No data yet", processing: "Processing…", selected: "Selected", languageCode: "English",
  },
} as const;

const activityDictionary = {
  zh: { edit: "资料编辑", enrichment: "资料补全", vector_update: "向量更新", official_refresh: "官方数据刷新", draft: "待审核", applied: "已应用", completed: "已完成", failed: "失败" },
  en: { edit: "Profile edit", enrichment: "Data enrichment", vector_update: "Vector update", official_refresh: "Official data refresh", draft: "Draft", applied: "Applied", completed: "Completed", failed: "Failed" },
} as const;

export function dataActivityText(locale: Locale, value: keyof typeof activityDictionary.zh) { return activityDictionary[locale][value]; }

type Translation = { [Key in keyof typeof dictionary.zh]: string };
type LocaleContextValue = { locale: Locale; setLocale: (locale: Locale) => void; toggleLocale: () => void; t: Translation };
const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => (typeof window !== "undefined" && window.localStorage.getItem("matchwise-locale") === "en" ? "en" : "zh"));
  useEffect(() => { window.localStorage.setItem("matchwise-locale", locale); document.documentElement.lang = locale === "zh" ? "zh-CN" : "en"; }, [locale]);
  const value = useMemo(() => ({ locale, setLocale, toggleLocale: () => setLocale(current => current === "zh" ? "en" : "zh"), t: dictionary[locale] }), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocale must be used inside LocaleProvider");
  return value;
}
