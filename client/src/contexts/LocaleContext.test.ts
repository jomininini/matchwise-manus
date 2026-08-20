import { describe, expect, it } from "vitest";
import { dataActivityText, dictionary } from "./LocaleContext";

describe("bilingual workspace dictionary", () => {
  it("switches management labels and activity states with the selected locale", () => {
    expect(dictionary.zh.dataManagement).toBe("数据管理");
    expect(dictionary.en.dataManagement).toBe("Data Management");
    expect(dataActivityText("zh", "vector_update")).toBe("向量更新");
    expect(dataActivityText("en", "vector_update")).toBe("Vector update");
    expect(dataActivityText("zh", "draft")).toBe("待审核");
    expect(dataActivityText("en", "draft")).toBe("Draft");
  });
});
