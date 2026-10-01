import { beforeEach, describe, expect, it } from "vitest";
import { deriveSurface } from "../validators";
import { SENDER_FIXTURES } from "../security-fixtures";

describe("deriveSurface Origin Classification", () => {
  beforeEach(() => {
    global.chrome = {
      runtime: {
        id: "extension-id-placeholder",
        getURL: (path: string) => `safari-web-extension://B1982A12-D07E-4F35-86A9-7A5D2D5D5515/${path}`
      }
    } as unknown as typeof chrome;
  });

  it("should classify standard Chrome dashboard tab as dashboard surface", () => {
    const surface = deriveSurface(SENDER_FIXTURES.validDashboardTab);
    expect(surface).toBe("dashboard");
  });

  it("should classify Safari dashboard tab as dashboard surface even when sender has tab context", () => {
    const surface = deriveSurface(SENDER_FIXTURES.validSafariDashboardTab);
    expect(surface).toBe("dashboard");
  });

  it("should classify Chrome popup as popup surface", () => {
    const surface = deriveSurface(SENDER_FIXTURES.validPopupTab);
    expect(surface).toBe("popup");
  });

  it("should classify Safari popup as popup surface", () => {
    const surface = deriveSurface(SENDER_FIXTURES.validSafariPopupTab);
    expect(surface).toBe("popup");
  });

  it("should classify external webpage content scripts as content surface", () => {
    const surface = deriveSurface(SENDER_FIXTURES.validContentScript);
    expect(surface).toBe("content");
  });

  it("should reject malicious sender from external web origin as unknown", () => {
    const surface = deriveSurface(SENDER_FIXTURES.maliciousExternalPage);
    expect(surface).toBe("unknown");
  });

  it("should reject rogue cross-extension sender as unknown", () => {
    const surface = deriveSurface(SENDER_FIXTURES.rogueCrossExtension);
    expect(surface).toBe("unknown");
  });
});
