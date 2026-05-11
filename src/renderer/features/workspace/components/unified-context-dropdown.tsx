import { RefObject, useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { Button, DropdownWrapper } from "@/components/ui";
import { useClickOutside } from "@/hooks/use-click-outside";
import type { CommandInfo, SkillInfo } from "@/lib/redux/api/providersApi";
import { Sparkles } from "@/components/ui/icons";
import { useDropdownKeyboardNavigation } from "@/features/workspace/hooks/use-dropdown-keyboard-navigation";
import { FileIconComponent } from "@/features/workspace/components/file-explorer/components/file-icon";
import type { DirEntry, FileNode } from "@/features/workspace/types/file-explorer";
import type { IssueWithEntity } from "@/lib/redux/api/entitiesApi";
import { useGetIssuesByProjectQuery } from "@/lib/redux/api";
import { ProviderIcon } from "./provider-icon";

export type UnifiedContextTrigger = "@" | "/";

interface FetchState {
  entries: DirEntry[];
  loading: boolean;
  error: string | null;
}

type FetchAction =
  | { type: "fetch_start" }
  | { type: "fetch_success"; entries: DirEntry[] }
  | { type: "fetch_error"; error: string };

function fetchReducer(state: FetchState, action: FetchAction): FetchState {
  switch (action.type) {
    case "fetch_start":
      return { entries: [], loading: true, error: null };
    case "fetch_success":
      return { entries: action.entries, loading: false, error: null };
    case "fetch_error":
      return { entries: [], loading: false, error: action.error };
  }
}

function parseFileFilterText(filterText: string): { dirPath: string; nameFilter: string } {
  const lastSlash = filterText.lastIndexOf("/");
  if (lastSlash === -1) {
    return { dirPath: "", nameFilter: filterText };
  }
  return {
    dirPath: filterText.slice(0, lastSlash + 1),
    nameFilter: filterText.slice(lastSlash + 1),
  };
}

/** Lowercase relative path from workspace root, using / */
function workspaceRelativePath(fullPath: string, workspacePath: string): string {
  const root = workspacePath.replace(/\/$/, "");
  if (!fullPath.startsWith(root)) return fullPath;
  return fullPath.slice(root.length).replace(/^\//, "");
}

function workspaceRelativeDir(fullPath: string, workspacePath?: string): string {
  if (!workspacePath) return "";
  const root = workspacePath.replace(/\/$/, "");
  if (!fullPath.startsWith(root)) return "";
  const rel = fullPath.slice(root.length).replace(/^\//, "");
  return rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "";
}

const WORKSPACE_SEARCH_DEBOUNCE_MS = 320;
const MAX_WORKSPACE_FILE_MATCHES = 150;

function localImageUrl(absPath: string): string {
  return `mains-localimg://img/?path=${encodeURIComponent(absPath)}`;
}

function resolveImageUrl(src: string): string {
  if (/^(data:|https?:|mains-localimg:)/.test(src)) return src;
  return localImageUrl(src);
}

function bucketSkill(skill: SkillInfo): "plugins" | "mac_apps" | "skills" | null {
  if (skill.userInvokable === false) return null;
  const sc = (skill.scope || "").toLowerCase();
  if (sc === "plugin") return "plugins";
  if (sc === "mac" || sc === "mac_app" || sc === "computer") return "mac_apps";
  return "skills";
}

function SkillRowIcon({ skill }: { skill: SkillInfo }) {
  const [failed, setFailed] = useState(false);
  const iconPath = skill.iconLarge || skill.iconSmall;
  if (iconPath && !failed) {
    return (
      <img
        src={resolveImageUrl(iconPath)}
        alt=""
        className="size-5 rounded shrink-0 object-contain"
        style={skill.brandColor ? { backgroundColor: skill.brandColor } : undefined}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div
      className="size-5 rounded shrink-0 flex items-center justify-center bg-primary-200/50 dark:bg-primary-700/50 text-primary-600 dark:text-primary-300"
      style={skill.brandColor ? { backgroundColor: skill.brandColor, color: "#fff" } : undefined}
    >
      <Sparkles className="size-3" />
    </div>
  );
}

type FlatRow =
  | { kind: "skill"; skill: SkillInfo; bucket: "plugins" | "mac_apps" | "skills" }
  | { kind: "file"; entry: DirEntry; dirPath: string }
  | { kind: "issue"; item: IssueWithEntity }
  | { kind: "command"; command: CommandInfo };

interface UnifiedContextDropdownProps {
  isOpen: boolean;
  trigger: UnifiedContextTrigger;
  filterText: string;
  workspacePath?: string;
  projectId?: string;
  commands: CommandInfo[];
  skills: SkillInfo[];
  onSelectCommand: (command: CommandInfo) => void;
  onSelectSkill: (skill: SkillInfo) => void;
  onSelectFile: (node: FileNode) => void;
  onNavigateFile: (dirPath: string) => void;
  onSelectIssue: (issue: IssueWithEntity) => void;
  onClose: () => void;
  dropdownRef: RefObject<HTMLDivElement | null>;
}

function buildSections(
  pluginSkills: SkillInfo[],
  macSkills: SkillInfo[],
  regularSkills: SkillInfo[],
  sortedFiles: DirEntry[],
  fileDirPath: string,
  includeFilesSection: boolean,
  filteredIssues: IssueWithEntity[],
  filteredCommands: CommandInfo[],
): { title: string; rows: FlatRow[] }[] {
  const out: { title: string; rows: FlatRow[] }[] = [];
  if (pluginSkills.length > 0) {
    out.push({
      title: "Plugins",
      rows: pluginSkills.map((skill) => ({ kind: "skill" as const, skill, bucket: "plugins" as const })),
    });
  }
  if (macSkills.length > 0) {
    out.push({
      title: "Mac apps",
      rows: macSkills.map((skill) => ({ kind: "skill" as const, skill, bucket: "mac_apps" as const })),
    });
  }
  if (regularSkills.length > 0) {
    out.push({
      title: "Skills",
      rows: regularSkills.map((skill) => ({ kind: "skill" as const, skill, bucket: "skills" as const })),
    });
  }
  if (includeFilesSection) {
    out.push({
      title: "Files",
      rows: sortedFiles.map((entry) => ({ kind: "file" as const, entry, dirPath: fileDirPath })),
    });
  }
  if (filteredIssues.length > 0) {
    out.push({
      title: "Issues",
      rows: filteredIssues.map((item) => ({ kind: "issue" as const, item })),
    });
  }
  if (filteredCommands.length > 0) {
    out.push({
      title: "Commands",
      rows: filteredCommands.map((command) => ({ kind: "command" as const, command })),
    });
  }
  return out;
}

export function UnifiedContextDropdown({
  isOpen,
  trigger: _trigger,
  filterText,
  workspacePath,
  projectId,
  commands,
  skills,
  onSelectCommand,
  onSelectSkill,
  onSelectFile,
  onNavigateFile,
  onSelectIssue,
  onClose,
  dropdownRef,
}: UnifiedContextDropdownProps) {
  void _trigger;

  const [fetchState, dispatchFetch] = useReducer(fetchReducer, {
    entries: [],
    loading: false,
    error: null,
  });

  useClickOutside(dropdownRef, () => {
    if (isOpen) onClose();
  });

  const { dirPath, nameFilter } = useMemo(() => parseFileFilterText(filterText), [filterText]);

  const isWorkspaceFileSearch = dirPath === "" && nameFilter.length > 0;

  useEffect(() => {
    if (!isOpen || !workspacePath) return;

    if (!isWorkspaceFileSearch) {
      let cancelled = false;
      dispatchFetch({ type: "fetch_start" });

      const fullDirPath = dirPath
        ? `${workspacePath}/${dirPath.replace(/\/$/, "")}`
        : workspacePath;

      window.api.fileExplorer
        .listDir({ dirPath: fullDirPath })
        .then((response: { success: boolean; data?: DirEntry[]; error?: string }) => {
          if (cancelled) return;
          if (response.success && response.data) {
            dispatchFetch({ type: "fetch_success", entries: response.data });
          } else {
            dispatchFetch({ type: "fetch_error", error: response.error || "Failed to list directory" });
          }
        })
        .catch((err: Error) => {
          if (!cancelled) {
            dispatchFetch({ type: "fetch_error", error: err.message });
          }
        });

      return () => {
        cancelled = true;
      };
    }

    let cancelled = false;
    dispatchFetch({ type: "fetch_start" });

    const timeoutId = window.setTimeout(() => {
      window.api.fileExplorer
        .searchFiles({
          rootPath: workspacePath,
          query: nameFilter,
          max: MAX_WORKSPACE_FILE_MATCHES,
        })
        .then((response: { success: boolean; data?: DirEntry[]; error?: string }) => {
          if (cancelled) return;
          if (response.success && response.data) {
            dispatchFetch({ type: "fetch_success", entries: response.data });
          } else {
            dispatchFetch({ type: "fetch_error", error: response.error || "Failed to search workspace" });
          }
        })
        .catch((err: Error) => {
          if (!cancelled) {
            dispatchFetch({ type: "fetch_error", error: err.message });
          }
        });
    }, WORKSPACE_SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [isOpen, workspacePath, dirPath, nameFilter, isWorkspaceFileSearch]);

  const { data: issues = [], isLoading: isLoadingIssues } = useGetIssuesByProjectQuery(projectId ?? "", {
    skip: !isOpen || !projectId,
  });

  const filteredIssues = useMemo(() => {
    if (!filterText) return issues;
    const lower = filterText.toLowerCase();
    return issues.filter((item) => {
      const num = item.issue.number != null ? String(item.issue.number) : "";
      return item.entity.title.toLowerCase().includes(lower) || num.includes(lower);
    });
  }, [issues, filterText]);

  const filteredCommands = useMemo(() => {
    const userFacing = commands.filter((cmd) => cmd.userFacing !== false);
    if (!filterText) return userFacing;
    const lower = filterText.toLowerCase();
    return userFacing.filter((cmd) => {
      const nameMatch = cmd.name.toLowerCase().includes(lower);
      const descMatch = cmd.description?.toLowerCase().includes(lower);
      return nameMatch || descMatch;
    });
  }, [commands, filterText]);

  const { pluginSkills, macSkills, regularSkills } = useMemo(() => {
    const plugins: SkillInfo[] = [];
    const mac: SkillInfo[] = [];
    const rest: SkillInfo[] = [];
    for (const s of skills) {
      const b = bucketSkill(s);
      if (b === "plugins") plugins.push(s);
      else if (b === "mac_apps") mac.push(s);
      else if (b === "skills") rest.push(s);
    }
    const lower = filterText.toLowerCase();
    const filterSkill = (list: SkillInfo[]) => {
      if (!filterText) return list;
      return list.filter((s) => {
        const nameMatch = s.name.toLowerCase().includes(lower);
        const displayMatch = s.displayName?.toLowerCase().includes(lower);
        const descMatch =
          s.shortDescription?.toLowerCase().includes(lower) || s.description?.toLowerCase().includes(lower);
        return nameMatch || displayMatch || descMatch;
      });
    };
    return {
      pluginSkills: filterSkill(plugins),
      macSkills: filterSkill(mac),
      regularSkills: filterSkill(rest),
    };
  }, [skills, filterText]);

  const filteredFileEntries = useMemo(() => {
    if (isWorkspaceFileSearch) return fetchState.entries;
    if (!nameFilter) return fetchState.entries;
    const lower = nameFilter.toLowerCase();
    return fetchState.entries.filter((e) => e.name.toLowerCase().includes(lower));
  }, [fetchState.entries, nameFilter, isWorkspaceFileSearch]);

  const sortedFiles = useMemo(() => {
    if (isWorkspaceFileSearch) {
      return [...filteredFileEntries].sort((a, b) =>
        workspaceRelativePath(a.fullPath, workspacePath ?? "").localeCompare(
          workspaceRelativePath(b.fullPath, workspacePath ?? ""),
        ),
      );
    }
    return [...filteredFileEntries].sort((a, b) => {
      if (a.type === "directory" && b.type !== "directory") return -1;
      if (a.type !== "directory" && b.type === "directory") return 1;
      return a.name.localeCompare(b.name);
    });
  }, [filteredFileEntries, isWorkspaceFileSearch, workspacePath]);

  const sections = useMemo(() => {
    return buildSections(
      pluginSkills,
      macSkills,
      regularSkills,
      sortedFiles,
      dirPath,
      Boolean(workspacePath),
      filteredIssues,
      filteredCommands,
    );
  }, [
    pluginSkills,
    macSkills,
    regularSkills,
    sortedFiles,
    dirPath,
    workspacePath,
    filteredIssues,
    filteredCommands,
  ]);

  const flatRows = useMemo(() => sections.flatMap((s) => s.rows), [sections]);

  const sectionBaseIndex = useMemo(() => {
    const bases: number[] = [];
    let acc = 0;
    for (let i = 0; i < sections.length; i++) {
      bases[i] = acc;
      acc += sections[i].rows.length;
    }
    return bases;
  }, [sections]);

  const selectRowAt = useCallback(
    (index: number) => {
      const row = flatRows[index];
      if (!row) return;
      switch (row.kind) {
        case "command":
          onSelectCommand(row.command);
          onClose();
          break;
        case "skill":
          onSelectSkill(row.skill);
          onClose();
          break;
        case "issue":
          onSelectIssue(row.item);
          onClose();
          break;
        case "file": {
          const { entry, dirPath: d } = row;
          if (entry.type === "directory") {
            onNavigateFile(d + entry.name + "/");
            return;
          }
          onSelectFile({
            name: entry.name,
            fullPath: entry.fullPath,
            type: entry.type,
            extension: entry.extension,
            size: entry.size,
          });
          onClose();
          break;
        }
      }
    },
    [flatRows, onClose, onNavigateFile, onSelectCommand, onSelectFile, onSelectIssue, onSelectSkill],
  );

  const { activeIndex, setActiveIndex } = useDropdownKeyboardNavigation({
    isOpen,
    itemCount: flatRows.length,
    disabled: flatRows.length === 0,
    resetKey: filterText,
    onSelectActive: selectRowAt,
  });

  if (!isOpen) return null;

  const isLoading =
    flatRows.length === 0 && (fetchState.loading || (Boolean(projectId) && isLoadingIssues));

  return (
    <div ref={dropdownRef}>
      <DropdownWrapper
        isOpen={isOpen}
        openUpward={true}
        minWidth="min-w-[22rem]"
        useFixedBackground={true}
      >
        <div className="max-h-96 max-w-115 overflow-auto noscrollbar">
          {dirPath && (
            <div className="px-3 pt-2 pb-1 text-xs font-medium truncate text-primary-400 dark:text-primary-500">
              {dirPath}
            </div>
          )}
          {isLoading ? (
            <div className="px-4 py-3 text-sm text-primary-500 dark:text-primary-400">Loading...</div>
          ) : flatRows.length === 0 &&
            !fetchState.loading &&
            !isLoadingIssues &&
            (workspacePath ? !fetchState.error : true) ? (
            <div className="px-4 py-3 text-sm text-primary-500 dark:text-primary-400">No matches</div>
          ) : (
            sections.map((section, sectionIndex) => {
              if (section.rows.length === 0 && section.title !== "Files") return null;
              if (section.title === "Files" && section.rows.length === 0 && !fetchState.loading && !fetchState.error) {
                return null;
              }
              const baseIdx = sectionBaseIndex[sectionIndex];
              return (
                <div key={`${section.title}-${sectionIndex}`}>
                  <div className="px-3 pt-2 pb-1 text-xs font-medium text-primary-400 dark:text-primary-500">
                    {section.title}
                  </div>
                  {section.title === "Files" && fetchState.loading && (
                    <div className="px-4 py-2 text-xs text-primary-500 dark:text-primary-400">Loading files…</div>
                  )}
                  {section.title === "Files" && fetchState.error && (
                    <div className="px-4 py-2 text-xs text-primary-500 dark:text-primary-400">{fetchState.error}</div>
                  )}
                  {section.title === "Files" &&
                    isWorkspaceFileSearch &&
                    sortedFiles.length >= MAX_WORKSPACE_FILE_MATCHES && (
                      <div className="px-3 pb-1 text-xxs text-primary-500 dark:text-primary-500">
                        Showing first {MAX_WORKSPACE_FILE_MATCHES} matches — narrow your search for more specific
                        results.
                      </div>
                    )}
                  {section.rows.map((row, j) => {
                    const idx = baseIdx + j;
                    const active = idx === activeIndex;
                    if (row.kind === "skill") {
                      const skill = row.skill;
                      const title = skill.displayName || skill.name;
                      const desc = skill.shortDescription || skill.description;
                      return (
                        <Button
                          key={`${row.bucket}-${skill.name}-${skill.path ?? ""}`}
                          type="button"
                          data-dropdown-active={active ? "true" : undefined}
                          onMouseEnter={() => setActiveIndex(idx)}
                          onClick={() => selectRowAt(idx)}
                          className={`w-full text-left px-3 py-1.5 cursor-pointer text-sm transition-colors hover:bg-primary-200/30 dark:hover:bg-primary-800 text-primary-700 dark:text-primary-100 ${
                            active ? "bg-primary-200/30 dark:bg-primary-800" : ""
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <SkillRowIcon skill={skill} />
                            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                              <div className="font-medium truncate">{title}</div>
                              {desc && (
                                <div className="text-xs line-clamp-2 text-primary-500 dark:text-primary-400">{desc}</div>
                              )}
                            </div>
                          </div>
                        </Button>
                      );
                    }
                    if (row.kind === "file") {
                      const { entry } = row;
                      return (
                        <Button
                          key={entry.fullPath}
                          type="button"
                          data-dropdown-active={active ? "true" : undefined}
                          onMouseEnter={() => setActiveIndex(idx)}
                          onClick={() => selectRowAt(idx)}
                          className={`w-full text-left px-3 py-1.5 cursor-pointer text-sm transition-colors hover:bg-primary-200/30 dark:hover:bg-primary-800 text-primary-700 dark:text-primary-100 ${
                            active ? "bg-primary-200/30 dark:bg-primary-800" : ""
                          }`}
                        >
                          <div className="flex items-start gap-2 min-w-0">
                            <FileIconComponent
                              isDirectory={entry.type === "directory"}
                              extension={entry.extension}
                              fileName={entry.name}
                              className="size-4 shrink-0 mt-0.5"
                            />
                            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                              <span className="truncate font-medium">{entry.name}</span>
                              {entry.type !== "directory" && (
                                <span className="text-xs text-primary-500 dark:text-primary-400 truncate">
                                  {workspaceRelativeDir(entry.fullPath, workspacePath) || entry.fullPath}
                                </span>
                              )}
                            </div>
                            {entry.type === "directory" && (
                              <span className="ml-auto text-xs text-primary-500 dark:text-primary-400 shrink-0">/</span>
                            )}
                          </div>
                        </Button>
                      );
                    }
                    if (row.kind === "issue") {
                      const item = row.item;
                      return (
                        <Button
                          key={item.issue.entityId}
                          type="button"
                          data-dropdown-active={active ? "true" : undefined}
                          onMouseEnter={() => setActiveIndex(idx)}
                          onClick={() => selectRowAt(idx)}
                          className={`w-full text-left px-3 py-1.5 cursor-pointer text-sm transition-colors hover:bg-primary-200/30 dark:hover:bg-primary-800 text-primary-700 dark:text-primary-100 ${
                            active ? "bg-primary-200/30 dark:bg-primary-800" : ""
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <ProviderIcon
                              provider={item.issue.provider}
                              className="w-3.5 h-3.5 shrink-0"
                              fallback="text"
                            />
                            {item.issue.number != null && (
                              <span className="text-xs shrink-0 text-primary-500 dark:text-primary-400">
                                #{item.issue.number}
                              </span>
                            )}
                            <span className="truncate">{item.entity.title}</span>
                          </div>
                        </Button>
                      );
                    }
                    const cmd = row.command;
                    return (
                      <Button
                        key={`cmd-${cmd.name}`}
                        type="button"
                        data-dropdown-active={active ? "true" : undefined}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => selectRowAt(idx)}
                        className={`w-full text-left px-3 py-1.5 cursor-pointer text-sm transition-colors hover:bg-primary-200/30 dark:hover:bg-primary-800 text-primary-700 dark:text-primary-100 ${
                          active ? "bg-primary-200/30 dark:bg-primary-800" : ""
                        }`}
                      >
                        <div className="flex flex-col gap-0.5">
                          <div className="font-medium">/{cmd.name}</div>
                          {cmd.description && (
                            <div className="text-xs line-clamp-2 text-primary-500 dark:text-primary-400">
                              {cmd.description}
                            </div>
                          )}
                        </div>
                      </Button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </DropdownWrapper>
    </div>
  );
}
