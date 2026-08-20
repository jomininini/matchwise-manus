# Company Match 官方数据源验证

用户指定的 DATA.GOV.HK 资源确认由 Hong Kong Science and Technology Parks Corporation 提供，数据格式为 JSON，标注为 API 可用且实时更新。官方公司目录端点为：

`https://opendata.hkstp.org/corporate/companydirectory/v1/`

接口返回对象中的 `value` 数组。每家公司记录包含英文、繁体与简体中文资料，例如 `name_EN`、`cluster`、`introduction_EN`、`product_EN`、`website`，以及对应的中文字段。该端点可作为 Company Match 的唯一权威公司资料来源；导入流程将保留原始 JSON、生成规范化 CSV，并以规范化文本构建后续向量索引。

浏览器验证已在 Company Match 页面输入代表性需求：“寻找提供人工智能、物联网和商业楼宇节能解决方案的香港科技公司”。页面正确呈现 Company Match、Company directory、Saved 与 Dataset administration 四个聚焦入口，下一步验证 LLM 优化与最终匹配结果。

LLM 优化步骤已在浏览器完成；系统将原始中文需求回填为可编辑的 refined statement。该 statement 随后可直接用于 OpenRouter embedding 与 TiDB 余弦向量检索。

最终匹配请求已在浏览器触发，界面进入“正在向量检索并逐家公司验证”的加载状态。该阶段使用 Top-K=10，并发调用分析层以保留合适结果、剔除不符合需求的公司。

浏览器端最终 Company Match 成功完成：系统保留 10 个结果并剔除 10 个不适合候选，结果包含公司、HKSTP cluster、匹配分数、语义相似度、证据、资料缺口和必要时的验证搜索建议；“导出 CSV”控件可用。前两名结果为 Carnot Innovations Limited 与 CyanSE Smart Energy Tech Limited，匹配分数均为 95%。

外部核验采用受控模式：LLM 仅在资料存在重要事实缺口时返回短验证查询，而非自行宣称未验证的网络事实。项目预置的数据 API 助手可在后续连接合适的公开搜索数据源后执行这些查询；目前结果明确展示建议查询和未确认项。

CSV 导出已在浏览器下载历史验证成功，文件名为 `company-match-results.csv`，由 Company Match 结果页面生成。

非默认 Top-K 验证已完成：将 Top-K 改为 3 后，系统最终保留 3 个公司结果并剔除 13 个候选，页面与服务端配置一致。保留结果为 Carnot Innovations Limited、IBUILDING LIMITED 与 Carbon Exchange (Hong Kong) Limited。
