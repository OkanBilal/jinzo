import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Store original env
const originalEnv = process.env;

import { feedbackService } from "./feedback.service";

describe("feedbackService", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("send", () => {
    it("returns error when RESEND_API_KEY is not set", async () => {
      delete process.env.RESEND_API_KEY;

      const result = await feedbackService.send({ message: "hello" });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("RESEND_API_KEY is not configured");
    });

    it("returns error when message is empty", async () => {
      process.env.RESEND_API_KEY = "test-key";

      const result = await feedbackService.send({ message: "" });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("Message is required");
    });

    it("returns error when message is whitespace only", async () => {
      process.env.RESEND_API_KEY = "test-key";

      const result = await feedbackService.send({ message: "   " });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("Message is required");
    });

    it("sends feedback successfully", async () => {
      process.env.RESEND_API_KEY = "test-key";

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "email-123" }),
      }));

      const result = await feedbackService.send({ message: "Great app!" });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.id).toBe("email-123");

      // Verify fetch was called with correct params
      expect(fetch).toHaveBeenCalledWith(
        "https://api.resend.com/emails",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-key",
          }),
        }),
      );
    });

    it("returns error on API failure", async () => {
      process.env.RESEND_API_KEY = "test-key";

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve("Bad request"),
      }));

      const result = await feedbackService.send({ message: "feedback" });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("Failed to send feedback");
    });

    it("returns error on network failure", async () => {
      process.env.RESEND_API_KEY = "test-key";

      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

      const result = await feedbackService.send({ message: "feedback" });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("Failed to send feedback");
    });
  });
});
