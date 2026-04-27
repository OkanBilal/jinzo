import { useState } from "react";
import { ArrowUp, Question, Check } from "@/components/ui/icons";

interface QuestionOption {
  label: string;
  description?: string;
}

interface QuestionItem {
  question: string;
  header?: string;
  options?: QuestionOption[];
  multiSelect?: boolean;
}

export interface AskUserQuestionParams {
  questions?: QuestionItem[];
  question?: string;
}

interface AskUserQuestionOutput {
  questions?: QuestionItem[];
  answers?: Record<string, string | string[]>;
}

export function AskUserQuestionDisplay({
  params,
  output,
  isCompact = false,
}: {
  params: AskUserQuestionParams;
  output?: unknown;
  isCompact?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const parsed = parseOutput(output);
  const fromParams = params.questions?.length
    ? params.questions
    : typeof params.question === "string" && params.question.trim()
      ? [{ question: params.question.trim() }]
      : [];
  const questions = parsed?.questions?.length
    ? parsed.questions
    : fromParams;
  const answers = parsed?.answers;
  const header =
    questions[0]?.header ??
    questions[0]?.question ??
    params.question ??
    "Question";

  const hasContent = questions.length > 0;

  return (
    <div className="">
      <button
        type="button"
        onClick={() => hasContent && setIsExpanded(!isExpanded)}
        className={`group w-full flex items-center gap-1 py-1 text-s font-sans ${hasContent ? "cursor-pointer" : "cursor-default"}`}
      >
        {!isCompact && (
          <Question className="size-4 shrink-0 text-primary-500 group-hover:text-primary-950 group-hover:dark:text-primary" />
        )}
        {!isCompact && (
          <span className="text-primary-500 group-hover:text-primary-950 group-hover:dark:text-primary">
            Question
          </span>
        )}
        <span className="text-primary-500 truncate group-hover:text-primary-950 group-hover:dark:text-primary min-w-0">
          {header}
        </span>
        {hasContent && (
          <ArrowUp
            className={`size-3.5 shrink-0 text-primary-500 opacity-0 transition-all duration-200 group-hover:text-primary-950 group-hover:dark:text-primary group-hover:opacity-100 ${isExpanded ? "rotate-180" : "rotate-90"}`}
          />
        )}
      </button>

      {hasContent && (
        <div
          className={`grid transition-all duration-200 ease-out ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="text-xs font-sans text-primary-950 dark:text-primary bg-primary-50 dark:bg-primary/5 rounded-md p-2 max-h-48 overflow-y-auto noscrollbar space-y-3">
              {questions.map((q, qi) => {
                const selectedAnswer = answers?.[String(qi)];

                return (
                  <div key={qi} className="space-y-2">
                    <div className="font-medium text-primary-700 dark:text-primary-300">
                      {q.question}
                    </div>

                    {q.options && q.options.length > 0 && (
                      <div className="space-y-1.5">
                        {q.options.map((opt) => {
                          const isSelected =
                            selectedAnswer === opt.label ||
                            (Array.isArray(selectedAnswer) &&
                              selectedAnswer.includes(opt.label));

                          return (
                            <div
                              key={opt.label}
                              className={`flex items-start gap-2 rounded px-2 py-1.5 ${
                                isSelected
                                  ? "bg-green-50/80 dark:bg-green-500/10"
                                  : "bg-primary-100/60 dark:bg-primary/10"
                              }`}
                            >
                              {isSelected && (
                                <Check className="size-3 mt-0.5 text-green-600 dark:text-green-400 shrink-0" />
                              )}
                              <div className="min-w-0">
                                <span
                                  className={
                                    isSelected
                                      ? "font-medium text-green-700 dark:text-green-300"
                                      : "font-medium text-primary-700 dark:text-primary-300"
                                  }
                                >
                                  {opt.label}
                                </span>
                                {opt.description && (
                                  <span className="text-primary-500 ml-1">
                                    — {opt.description}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {(!q.options || q.options.length === 0) &&
                      selectedAnswer != null &&
                      String(selectedAnswer).trim() !== "" && (
                      <div className="flex items-start gap-2 rounded px-2 py-1.5 bg-green-50/80 dark:bg-green-500/10">
                        <Check className="size-3 mt-0.5 text-green-600 dark:text-green-400 shrink-0" />
                        <span className="font-medium text-green-700 dark:text-green-300 min-w-0 wrap-break-word">
                          {Array.isArray(selectedAnswer)
                            ? selectedAnswer.join(", ")
                            : String(selectedAnswer)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function parseOutput(output: unknown): AskUserQuestionOutput | null {
  if (!output) return null;

  let parsed = output;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }

  if (typeof parsed === "object" && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    let answers = obj.answers as
      | Record<string, string | string[]>
      | undefined;
    if (!answers) {
      const fromUserResponse = extractUserResponseAnswer(
        obj.content,
        obj.detailedContent,
      );
      if (fromUserResponse) {
        answers = { "0": fromUserResponse };
      }
    }
    return {
      questions: Array.isArray(obj.questions)
        ? (obj.questions as QuestionItem[])
        : undefined,
      answers,
    };
  }

  return null;
}

/** Copilot / broker style: { content: "User responded: …" } */
function extractUserResponseAnswer(
  content: unknown,
  detailedContent: unknown,
): string | undefined {
  for (const field of [content, detailedContent]) {
    if (typeof field !== "string" || !field.trim()) continue;
    const m = field.match(/^User responded:\s*(.*)$/i);
    if (m) return m[1].trim();
  }
  return undefined;
}
