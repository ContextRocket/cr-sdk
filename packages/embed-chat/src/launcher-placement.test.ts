import { describe, expect, it } from "vitest";
import {
  isViewportAnchoredPosition,
  launcherBottomLift,
} from "./launcher-placement";

describe("isViewportAnchoredPosition", () => {
  it("only treats sticky or fixed UI as a launcher placement obstacle", () => {
    expect(isViewportAnchoredPosition("fixed")).toBe(true);
    expect(isViewportAnchoredPosition("sticky")).toBe(true);
    expect(isViewportAnchoredPosition("static")).toBe(false);
    expect(isViewportAnchoredPosition("relative")).toBe(false);
  });
});

describe("launcherBottomLift", () => {
  it("lifts the launcher clear of an overlapping page control", () => {
    expect(
      launcherBottomLift(
        { top: 772, right: 374, bottom: 820, left: 326 },
        [{ top: 790, right: 337, bottom: 834, left: 53 }],
      ),
    ).toBe(42);
  });

  it("moves past adjacent controls instead of covering the previous one", () => {
    expect(
      launcherBottomLift(
        { top: 772, right: 374, bottom: 828, left: 318 },
        [
          { top: 765, right: 337, bottom: 836, left: 53 },
          { top: 680, right: 337, bottom: 750, left: 53 },
        ],
      ),
    ).toBe(160);
  });

  it("does not move the launcher when controls do not overlap it", () => {
    expect(
      launcherBottomLift(
        { top: 772, right: 374, bottom: 820, left: 326 },
        [
          { top: 720, right: 337, bottom: 766, left: 53 },
          { top: 790, right: 312, bottom: 834, left: 53 },
        ],
      ),
    ).toBe(0);
  });

  it("uses the highest overlapping control and keeps a clear gap", () => {
    expect(
      launcherBottomLift(
        { top: 772, right: 374, bottom: 820, left: 326 },
        [
          { top: 790, right: 337, bottom: 834, left: 53 },
          { top: 760, right: 350, bottom: 800, left: 40 },
        ],
      ),
    ).toBe(72);
  });
});
