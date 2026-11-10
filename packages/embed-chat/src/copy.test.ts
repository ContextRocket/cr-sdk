import { describe, expect, it } from "vitest";
import { COPY, resolveWidgetLocale } from "./copy";

describe("widget locale copy", () => {
  it("uses a configured Chinese locale", () => {
    expect(resolveWidgetLocale("zh")).toBe("zh");
  });

  it("follows a Simplified Chinese document language", () => {
    expect(resolveWidgetLocale(undefined, "zh-CN")).toBe("zh");
  });

  it("provides localized fullscreen controls and suggestions", () => {
    expect(COPY.zh.expand).toBe("展开聊天");
    expect(COPY.zh.collapse).toBe("退出全屏");
    expect(COPY.zh.suggestionGroup).toBe("对话建议");
  });
});
