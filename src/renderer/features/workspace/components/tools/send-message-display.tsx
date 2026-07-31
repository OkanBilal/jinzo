import { useState } from "react";
import { SendMessage } from "@/components/ui/icons";
import { ToolHeader, ToolCollapse, ToolOutputBody } from "./_shared";
import { toolOutputText } from "../../utils/parse-tool-content";

/**
 * Protocol payload variant of `message`. Teammates negotiate shutdown and plan
 * approval by sending these objects instead of plain text, echoing the
 * originating `request_id` back with an `approve` verdict.
 */
export interface SendMessageProtocol {
  type?: string;
  request_id?: string;
  approve?: boolean;
  reason?: string;
  feedback?: string;
}

/**
 * Input to the `SendMessage` tool. `to` is a teammate name (or `"main"` for the
 * parent conversation) and `message` is either plain text or a protocol object.
 * `recipient` / `content` are the equivalent fields some adapters persist
 * alongside the canonical ones — read as fallbacks so older calls still render.
 */
export interface SendMessageParams {
  to?: string;
  summary?: string;
  message?: string | SendMessageProtocol;
  recipient?: string;
  content?: string;
}

/** Delivery receipt returned by the tool, JSON-encoded inside a text block. */
interface SendMessageReceipt {
  success?: boolean;
  message?: string;
  resumedAgentId?: string;
}

const PROTOCOL_LABELS: Record<string, string> = {
  shutdown_request: "Shutdown request",
  shutdown_response: "Shutdown response",
  plan_approval_request: "Plan approval request",
  plan_approval_response: "Plan approval response",
};

function parseReceipt(output: unknown): { receipt: SendMessageReceipt; raw: string } {
  const raw = toolOutputText(output);
  if (!raw) return { receipt: {}, raw: "" };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { receipt: parsed as SendMessageReceipt, raw };
    }
  } catch {
    /* Not JSON — surface the text as-is. */
  }
  return { receipt: {}, raw };
}

export function SendMessageDisplay({
  params,
  output,
  isCompact = false,
}: {
  params: SendMessageParams;
  output?: unknown;
  isCompact?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const recipient = params.to || params.recipient || "";

  // Only an object `message` is a protocol handshake; a string one is the
  // teammate-visible body (older calls persist that body as `content`).
  const protocol =
    params.message && typeof params.message === "object" ? params.message : undefined;
  const body =
    typeof params.message === "string" ? params.message : params.content || "";

  const { receipt, raw } = parseReceipt(output);
  // The receipt restates the delivery outcome; only show it when it adds
  // something beyond the raw JSON we already parsed.
  const receiptText = receipt.message || (receipt.success === undefined ? raw : "");

  const protocolLabel = protocol?.type
    ? PROTOCOL_LABELS[protocol.type] ?? protocol.type
    : "";
  const headline = params.summary || protocolLabel || body || "message";

  const hasDetails = !!body || !!protocol || !!receiptText;

  return (
    <div>
      <ToolHeader
        icon={<SendMessage className="size-4" />}
        verb="Sent"
        hasDetails={hasDetails}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded((v) => !v)}
        isCompact={isCompact}
      >
        {recipient && (
          <span className="shrink-0 max-w-40 truncate font-medium text-primary-600 dark:text-primary-300">
            {recipient}
          </span>
        )}
        <span className="text-primary-500 truncate group-hover:text-primary-950 group-hover:dark:text-primary">
          {headline}
        </span>
      </ToolHeader>

      {hasDetails && (
        <ToolCollapse isExpanded={isExpanded}>
          <ToolOutputBody as="div" className="text-s font-sans space-y-2">
            {protocol && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{protocolLabel}</span>
                {protocol.approve !== undefined && (
                  <span
                    className={`rounded px-1.5 py-px text-t font-medium ${
                      protocol.approve
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-red-500/10 text-red-600 dark:text-red-400"
                    }`}
                  >
                    {protocol.approve ? "approved" : "rejected"}
                  </span>
                )}
              </div>
            )}

            {protocol && (protocol.feedback || protocol.reason) && (
              <p className="whitespace-pre-wrap text-primary-600 dark:text-primary-300">
                {protocol.feedback || protocol.reason}
              </p>
            )}

            {body && (
              <p className="noscrollbar whitespace-pre-wrap max-h-48 overflow-y-auto">
                {body}
              </p>
            )}

            {(receiptText || receipt.resumedAgentId) && (
              <div className="pt-1 border-t border-primary-100 dark:border-primary/10 space-y-0.5 text-t text-primary-500 dark:text-primary-400">
                {receiptText && (
                  <p className="whitespace-pre-wrap wrap-break-word">{receiptText}</p>
                )}
                {receipt.resumedAgentId && (
                  <div className="font-mono">
                    <span className="text-primary-400 dark:text-primary-500">Resumed</span>{" "}
                    {receipt.resumedAgentId}
                  </div>
                )}
              </div>
            )}
          </ToolOutputBody>
        </ToolCollapse>
      )}
    </div>
  );
}
