import { useState, useCallback, useEffect, useRef } from "react";
import type { Run, RunEvent, RunArtifact, ToolCall } from "../types";
import { toast } from "@/components/ui/toast";

const MAX_DISPLAY_LENGTH = 200;


/**
 * Format tool input/output data for display
 * Truncates long content and shows file paths nicely
 */
function formatToolData(data: unknown): string {
  if (!data) return "";
  
  let parsed: unknown = data;
  
  // Parse JSON string if needed
  if (typeof data === "string") {
    try {
      parsed = JSON.parse(data);
    } catch {
      // Not JSON, use as-is but truncate
      if (data.length > MAX_DISPLAY_LENGTH) {
        return data.substring(0, MAX_DISPLAY_LENGTH) + `... (${data.length} chars)`;
      }
      return data;
    }
  }
  
  // Handle object data
  if (typeof parsed === "object" && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    
    // Special handling for file content
    if (obj.content && typeof obj.content === "string") {
      const content = obj.content;
      const lines = content.split("\n").length;
      const bytes = content.length;
      
      // If there's a path, show it prominently
      if (obj.path && typeof obj.path === "string") {
        return `${obj.path} (${lines} lines, ${formatBytes(bytes)})`;
      }
      
      // For diff/patch content
      if (obj.detailedContent && typeof obj.detailedContent === "string") {
        const diffLines = obj.detailedContent.split("\n").length;
        return `File content (${lines} lines) with diff (${diffLines} lines)`;
      }
      
      // Truncate long content
      if (content.length > MAX_DISPLAY_LENGTH) {
        const preview = content.substring(0, MAX_DISPLAY_LENGTH).replace(/\n/g, " ");
        return `${preview}... (${lines} lines)`;
      }
    }
    
    // Special handling for file paths
    if (obj.path && typeof obj.path === "string") {
      const otherKeys = Object.keys(obj).filter(k => k !== "path" && k !== "content");
      if (otherKeys.length === 0) {
        return obj.path;
      }
      return `${obj.path} ${JSON.stringify(Object.fromEntries(otherKeys.map(k => [k, obj[k]])))}`;
    }
    
    // For other objects, show compact JSON
    const json = JSON.stringify(parsed);
    if (json.length > MAX_DISPLAY_LENGTH) {
      // Show key names for context
      const keys = Object.keys(obj).slice(0, 5);
      return `{${keys.join(", ")}${keys.length < Object.keys(obj).length ? ", ..." : ""}} (${json.length} chars)`;
    }
    return json;
  }
  
  return String(parsed);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function useWorkspaceRuns(workspaceId: string | undefined, providerId?: string) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [runEvents, setRunEvents] = useState<Record<string, RunEvent[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eventsEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Load run details (artifacts and tool calls)
  const loadRunDetails = useCallback(async (runId: string) => {
    try {
      const [artifactsRes, toolCallsRes] = await Promise.all([
        window.api.runArtifacts.getByRun(runId),
        window.api.runs.getToolCalls(runId),
      ]);

      const events: RunEvent[] = [];

      // Convert artifacts to events
      if (artifactsRes.success && artifactsRes.data) {
        artifactsRes.data.forEach((artifact: RunArtifact) => {
          try {
            let parsedMetadata: Record<string, unknown> | undefined;
            if (artifact.metadata) {
              if (typeof artifact.metadata === "string") {
                try {
                  parsedMetadata = JSON.parse(artifact.metadata);
                } catch {
                  parsedMetadata = undefined;
                }
              } else {
                parsedMetadata = artifact.metadata as unknown as Record<string, unknown>;
              }
            }

            events.push({
              id: `artifact-${artifact.id}`,
              type: artifact.kind === "log" ? "log" : "artifact",
              content: artifact.content || artifact.path || JSON.stringify(artifact),
              timestamp: artifact.createdAt ? new Date(artifact.createdAt) : new Date(),
              metadata: { ...parsedMetadata, kind: artifact.kind },
            });
          } catch (parseErr) {
            console.error("Error parsing artifact:", artifact, parseErr);
            events.push({
              id: `artifact-${artifact.id}`,
              type: artifact.kind === "log" ? "log" : "artifact",
              content: artifact.content || artifact.path || String(artifact),
              timestamp: new Date(),
              metadata: { kind: artifact.kind },
            });
          }
        });
      }

      // Convert tool calls to events
      if (toolCallsRes.success && toolCallsRes.data) {
        toolCallsRes.data.forEach((tc: ToolCall) => {
          try {
            const inputDisplay = formatToolData(tc.input);
            const outputDisplay = formatToolData(tc.output);

            // Parse raw input for metadata
            let rawInput: Record<string, unknown> | undefined;
            if (tc.input) {
              try {
                rawInput = typeof tc.input === "string" ? JSON.parse(tc.input) : tc.input as Record<string, unknown>;
              } catch {
                // Input is not valid JSON
              }
            }

            events.push({
              id: `tool-${tc.id}`,
              type: "tool_call",
              content: `${tc.toolName}: ${inputDisplay}${outputDisplay ? `\n→ ${outputDisplay}` : ""}`,
              timestamp: tc.createdAt ? new Date(tc.createdAt) : new Date(),
              metadata: { status: tc.status, toolName: tc.toolName, input: rawInput },
            });
          } catch (parseErr) {
            console.error("Error parsing tool call:", tc, parseErr);
          }
        });
      }

      // Sort by timestamp
      events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      setRunEvents((prev) => ({
        ...prev,
        [runId]: events,
      }));
    } catch (err) {
      console.error("Failed to load run details:", err);
    }
  }, []);

  // Load runs for a workspace
  const loadWorkspaceRuns = useCallback(
    async (wsId: string) => {
      try {
        const result = await window.api.runs.getByWorkspace(wsId, 50);

        if (result.success && result.data) {
          // Filter runs by providerId if specified
          const filteredRuns = providerId
            ? result.data.filter((run: Run) => run.providerId === providerId)
            : result.data;
          
          setRuns(filteredRuns);
          if (filteredRuns.length > 0) {
            const firstRunId = filteredRuns[0].id;
            setActiveRunId(firstRunId);
            loadRunDetails(firstRunId);
          }
        }
      } catch (err) {
        console.error("Failed to load workspace runs:", err);
      }
    },
    [loadRunDetails, providerId],
  );

  // When workspaceId changes from URL, load runs
  useEffect(() => {
    if (workspaceId) {
      // Clear previous workspace data before loading new
      setRuns([]);
      setActiveRunId(null);
      setRunEvents({});
      loadWorkspaceRuns(workspaceId);
    } else {
      // No workspace selected, clear everything
      setRuns([]);
      setActiveRunId(null);
      setRunEvents({});
    }
  }, [workspaceId, loadWorkspaceRuns]);

  // Poll for updates when active run is running
  useEffect(() => {
    const activeRun = runs.find((r) => r.id === activeRunId);
    if (!activeRun || activeRun.status !== "running") {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    pollingRef.current = setInterval(async () => {
      try {
        if (activeRunId) {
          loadRunDetails(activeRunId);

          const result = await window.api.runs.getById(activeRunId);
          if (result.success && result.data) {
            setRuns((prev) =>
              prev.map((r) => (r.id === activeRunId ? result.data : r)),
            );

            if (result.data.status !== "running") {
              if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
              }
            }
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 1000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [activeRunId, runs, loadRunDetails]);

  // Auto-scroll to bottom
  const currentEvents = activeRunId ? runEvents[activeRunId] || [] : [];
  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentEvents]);


  // Execute new run
  const executeRun = useCallback(
    async (goal: string, selectedWorkspace: string, selectedProvider: string, model?: string) => {
      if (!goal.trim() || !selectedWorkspace || !selectedProvider) {
        {/* ADD custom error workspace */}
        toast.error("Please fill in all required fields");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const accountRes = await window.api.account.get();
        if (!accountRes.success || !accountRes.data) {
          throw new Error("No account found");
        }

        const result = await window.api.runs.execute({
          accountId: accountRes.data.id,
          workspaceId: selectedWorkspace, 
          providerId: selectedProvider,
          goal: goal.trim(),
          model: model || undefined,
          initialContext: [
            {
              kind: "note", // 
              content: `User goal: ${goal.trim()}`,
            },
          ],
        });

        if (!result.success) {
          throw new Error(result.error || "Failed to start run");
        }

        const runResult = await window.api.runs.getById(result.data.runId);
        if (runResult.success && runResult.data) {
          const newRun = runResult.data;
          setRuns((prev) => [newRun, ...prev]);
          setActiveRunId(newRun.id);

          setRunEvents((prev) => ({
            ...prev,
            [newRun.id]: [
              {
                id: `event-${Date.now()}`,
                type: "status",
                content: `Run started: ${newRun.id}`,
                timestamp: new Date(),
              },
            ],
          }));
          
          return newRun.id; // Return new run ID for tab switching
        }

        return null;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to execute run";
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // Continue an existing run (resume session)
  const continueRun = useCallback(
    async (runId: string, message: string) => {
      if (!message.trim()) {
        setError("Please enter a message");
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        const accountRes = await window.api.account.get();
        if (!accountRes.success || !accountRes.data) {
          throw new Error("No account found");
        }

        const result = await window.api.runs.continue({
          runId,
          accountId: accountRes.data.id,
          message: message.trim(),
        });

        if (!result.success) {
          throw new Error(result.error || "Failed to continue run");
        }

        // Update the run in the list
        const runResult = await window.api.runs.getById(runId);
        if (runResult.success && runResult.data) {
          setRuns((prev) =>
            prev.map((r) => (r.id === runId ? runResult.data : r))
          );
        }

        // Add a status event for the continuation
        setRunEvents((prev) => ({
          ...prev,
          [runId]: [
            ...(prev[runId] || []),
            {
              id: `event-${Date.now()}`,
              type: "status",
              content: `Session resumed with message: ${message.trim().substring(0, 50)}...`,
              timestamp: new Date(),
            },
          ],
        }));

        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to continue run";
        setError(message);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // Check if a run's session can be resumed
  const checkCanResume = useCallback(async (runId: string): Promise<boolean> => {
    try {
      const result = await window.api.runs.canResume(runId);
      return result.success && result.data === true;
    } catch {
      return false;
    }
  }, []);

  // Close a run tab
  const closeTab = useCallback(
    (runId: string) => {
      setRuns((prev) => {
        const newRuns = prev.filter((r) => r.id !== runId);
        if (activeRunId === runId && newRuns.length > 0) {
          setActiveRunId(newRuns[0].id);
          loadRunDetails(newRuns[0].id);
        } else if (newRuns.length === 0) {
          setActiveRunId(null);
        }
        return newRuns;
      });
    },
    [activeRunId, loadRunDetails],
  );

  // Select a run tab
  const selectTab = useCallback(
    (runId: string) => {
      setActiveRunId(runId);
      if (!runEvents[runId]) {
        loadRunDetails(runId);
      }
    },
    [runEvents, loadRunDetails],
  );

  const activeRun = runs.find((r) => r.id === activeRunId);

  return {
    runs,
    activeRunId,
    activeRun,
    runEvents,
    currentEvents,
    isLoading,
    error,
    eventsEndRef,
    setActiveRunId,
    executeRun,
    continueRun,
    checkCanResume,
    closeTab,
    selectTab,
  };
}
