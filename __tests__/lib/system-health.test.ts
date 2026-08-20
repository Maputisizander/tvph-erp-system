import { classifyEmail, classifyNodeSync } from "@/lib/system/health";
import { formatBytes, formatDuration } from "@/lib/system/format";

jest.mock("@/lib/env", () => ({
  env: { RESEND_API_KEY: "test", EMAIL_FROM: "test@example.com" },
}));

describe("classifyNodeSync", () => {
  it("treats missing sync as error", () => {
    expect(classifyNodeSync(null)).toBe("error");
  });
  it("ok within 30m", () => {
    expect(classifyNodeSync(0)).toBe("ok");
    expect(classifyNodeSync(30)).toBe("ok");
  });
  it("warn within 2h", () => {
    expect(classifyNodeSync(31)).toBe("warn");
    expect(classifyNodeSync(120)).toBe("warn");
  });
  it("error after 2h", () => {
    expect(classifyNodeSync(121)).toBe("error");
  });
});

describe("classifyEmail", () => {
  it("unconfigured is error", () => {
    expect(classifyEmail({ configured: false, minutesSinceLastSend: null })).toBe("error");
  });
  it("configured with no sends yet is ok", () => {
    expect(classifyEmail({ configured: true, minutesSinceLastSend: null })).toBe("ok");
  });
  it("warn when idle over a day", () => {
    expect(classifyEmail({ configured: true, minutesSinceLastSend: 25 * 60 })).toBe("warn");
  });
});

describe("formatBytes", () => {
  it("formats units and keeps one decimal under 10", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(10 * 1024 * 1024)).toBe("10 MB");
    expect(formatBytes(368286270)).toBe("351 MB");
  });
});

describe("formatDuration", () => {
  it("humanizes minutes", () => {
    expect(formatDuration(0)).toBe("just now");
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(90)).toBe("1h 30m");
    expect(formatDuration(120)).toBe("2h");
  });
});