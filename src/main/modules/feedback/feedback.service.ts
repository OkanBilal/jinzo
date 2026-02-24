import type { ServiceResponse } from "../account/account.dto";

const RESEND_API_URL = "https://api.resend.com/emails";

export const feedbackService = {
  async send(payload: { message: string }): Promise<ServiceResponse<{ id: string }>> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return { success: false, error: "RESEND_API_KEY is not configured" };
    }

    const message = payload.message?.trim();
    if (!message) {
      return { success: false, error: "Message is required" };
    }

    try {
      const res = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: "Jinzo Feedback <hi@okanbilal.com>",
          to: "hi@okanbilal.com",
          subject: `Feedback: ${message.slice(0, 60)}${message.length > 60 ? "..." : ""}`,
          text: message,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        console.error("Resend API error:", res.status, body);
        return { success: false, error: "Failed to send feedback" };
      }

      const data = await res.json();
      return { success: true, data: { id: data.id } };
    } catch (err) {
      console.error("Feedback send error:", err);
      return { success: false, error: "Failed to send feedback" };
    }
  },
};
