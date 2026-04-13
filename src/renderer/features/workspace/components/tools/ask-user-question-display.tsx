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
  const questions = parsed?.questions ?? params.questions ?? [];
  const answers = parsed?.answers;
  const header = questions[0]?.header ?? params.question ?? "Question";

  const hasContent = questions.length > 0;

  return (
    <div className="px-2">
      <button
        onClick={() => hasContent && setIsExpanded(!isExpanded)}
        className={`w-full flex items-center gap-2 py-0.5 hover:bg-primary-50 dark:hover:bg-primary/5 rounded text-s font-sans ${hasContent ? "cursor-pointer" : "cursor-default"}`}
      >
        {hasContent && (
          <ArrowUp
            className={`size-3 text-primary-800 dark:text-primary-300 transition-all duration-200 ${isExpanded ? "rotate-180" : "rotate-90"}`}
          />
        )}
        {!isCompact && (
          <Question className="size-4 dark:text-primary-300 text-primary-700" />
        )}
        {!isCompact && (
          <span className="dark:text-primary-300 text-primary-700 font-medium">
            Question
          </span>
        )}
        <span className="text-primary-500 truncate">{header}</span>
      </button>

      {isExpanded && hasContent && (
        <div className="mt-2 ml-5 space-y-3 border-l border-primary-200/50 dark:border-primary-700/30 pl-3">
          {questions.map((q, qi) => {
            const selectedAnswer = answers?.[String(qi)];

            return (
              <div key={qi} className="space-y-1.5">
                <div className="text-s font-medium text-primary-700 dark:text-primary-300">
                  {q.question}
                </div>

                {q.options && q.options.length > 0 && (
                  <div className="space-y-1">
                    {q.options.map((opt) => {
                      const isSelected =
                        selectedAnswer === opt.label ||
                        (Array.isArray(selectedAnswer) &&
                          selectedAnswer.includes(opt.label));

                      return (
                        <div
                          key={opt.label}
                          className={`flex items-start gap-2 rounded px-2 py-1 text-xs font-sans ${
                            isSelected
                              ? "bg-green-50 dark:bg-green-500/10"
                              : "bg-primary-50 dark:bg-primary/5"
                          }`}
                        >
                          {isSelected && (
                            <Check className="size-3 mt-0.5 text-green-600 dark:text-green-400 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <span
                              className={`font-medium ${
                                isSelected
                                  ? "text-green-700 dark:text-green-300"
                                  : "text-primary-700 dark:text-primary-300"
                              }`}
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
              </div>
            );
          })}
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
    return {
      questions: Array.isArray(obj.questions)
        ? (obj.questions as QuestionItem[])
        : undefined,
      answers: obj.answers as Record<string, string | string[]> | undefined,
    };
  }

  return null;
}
