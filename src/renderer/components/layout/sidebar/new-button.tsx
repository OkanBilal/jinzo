import { useEffect, useRef, useState } from "react";
import { Body, Button, Caption, DropdownMenu, DropdownMenuItem, Text } from "@/components/ui";

interface NewButtonProps {
  onClick: () => void;
  title: string;
  actionPrefix?: string;
  icon?: React.ReactNode;
  dropdownItems?: { label: string; icon?: React.ReactNode; shortcut?: string; shortcutLabel?: string; onClick: () => void }[];
}

export default function NewButton({
  onClick,
  title,
  icon,
  actionPrefix = "New",
  dropdownItems,
}: NewButtonProps) {
  const [menuState, setMenuState] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
  }>({ isOpen: false, position: { x: 0, y: 0 } });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClick = () => {
    if (dropdownItems && dropdownItems.length > 0) {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setMenuState({
          isOpen: true,
          position: { x: rect.right , y: rect.top + 12 },
        });
      }
    } else {
      onClick();
    }
  };

  const handleCloseMenu = () => {
    setMenuState({ isOpen: false, position: { x: 0, y: 0 } });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === "n") {
        e.preventDefault();
        handleClick();
      }

      if (e.metaKey && e.shiftKey && dropdownItems) {
        const key = e.key.toLowerCase();
        const matched = dropdownItems.find((item) => item.shortcut === key);
        if (matched) {
          e.preventDefault();
          matched.onClick();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClick, dropdownItems]);

  return (
    <>
      <Button
        ref={buttonRef}
        tooltip={`${actionPrefix} ${title}`}
        variant="subtle"
        tooltipShortcut="⌘N"
        onClick={handleClick}
        fullWidth
        className="justify-start cursor-pointer transition-transform duration-200 px-2 rounded-xl"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        {icon}
        <Body className="text-s font-normal">
          {actionPrefix} {title}
        </Body>
        <Caption className="ml-auto">
          ⌘ N
        </Caption>
      </Button>

      {dropdownItems && (
        <DropdownMenu
          isOpen={menuState.isOpen}
          position={menuState.position}
          onClose={handleCloseMenu}
          minWidth={180}
        >
          {dropdownItems.map((item) => (
            <DropdownMenuItem
              key={item.label}
              onClick={() => {
                item.onClick();
                handleCloseMenu();
              }}
            >
              {item.icon}
              <Text className="flex-1 text-left text-s">{item.label}</Text>
              {item.shortcutLabel && (
                <Caption className="">
                  {item.shortcutLabel}
                </Caption>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenu>
      )}
    </>
  );
}
