import { useState, useRef, type MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { Layers } from "@/components/ui/icons";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";

export type GroupingMode = "none" | "status" | "project";

interface WorkspaceGroupDropdownProps {
  grouping: GroupingMode;
  onGroupingChange: (mode: GroupingMode) => void;
}

export function WorkspaceGroupDropdown({
  grouping,
  onGroupingChange,
}: WorkspaceGroupDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        x: Math.min(rect.left + 12, window.innerWidth - 180),
        y: rect.bottom,
      });
    }
    setIsOpen(!isOpen);
  };

  const handleSelect = (mode: GroupingMode) => {
    onGroupingChange(mode);
    setIsOpen(false);
  };

  const activeClass = "bg-primary-950/8 dark:bg-primary/10 font-medium";

  return (
    <>
      <Button
        ref={buttonRef}
        tooltip="Group workspaces"
        tooltipPosition="top"
        onClick={handleClick}
        className="p-1 rounded-md cursor-pointer hover:bg-primary/20 dark:hover:bg-primary/10 transition-colors"
      >
        <Layers
          className={`w-3.5 h-3.5 transition-colors ${
            grouping !== "none"
              ? "text-primary-950 dark:text-primary"
              : "text-primary-800 dark:text-primary-300"
          }`}
        />
      </Button>

      <DropdownMenu
        isOpen={isOpen}
        position={position}
        onClose={() => setIsOpen(false)}
        minWidth={160}
      >
        <DropdownMenuItem
          onClick={() => handleSelect("none")}
          className={grouping === "none" ? activeClass : ""}
        >
          Default
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleSelect("status")}
          className={grouping === "status" ? activeClass : ""}
        >
          Group by status
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleSelect("project")}
          className={grouping === "project" ? activeClass : ""}
        >
          Group by project
        </DropdownMenuItem>
      </DropdownMenu>
    </>
  );
}
