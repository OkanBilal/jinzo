import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import DropdownWrapper from "../../../components/ui/dropdown-wrapper";
import { Body } from "../../../components/ui/text";
import WeatherWidget from "../../../features/home/components/weather-widget";
import { useClickOutside } from "../../../features/chat/hooks/use-click-outside";

const HELP_MENU_ITEMS = [
  { label: "Help Center", href: "/help" },
  { label: "License", href: "/license" },
  { label: "What's Feed", href: "/about" },
] as const;

export default function FloatingWidgets() {
  const [isHelpMenuOpen, setIsHelpMenuOpen] = useState(false);
  const helpMenuRef = useRef<HTMLDivElement>(null);

  useClickOutside(helpMenuRef, () => setIsHelpMenuOpen(false));

  const toggleHelpMenu = () => setIsHelpMenuOpen(!isHelpMenuOpen);
  const closeHelpMenu = () => setIsHelpMenuOpen(false);

  return (
    <>
      <WeatherWidgetContainer />
      {/* <HelpMenuContainer
        isOpen={isHelpMenuOpen}
        onToggle={toggleHelpMenu}
        onClose={closeHelpMenu}
        menuRef={helpMenuRef}
      /> */}
    </>
  );
}

function WeatherWidgetContainer() {
  return (
    <div className="fixed top-4 right-17 z-1">
      <div className="flex items-center gap-2">
        <WeatherWidget />
      </div>
    </div>
  );
}

function HelpMenuContainer({
  isOpen,
  onToggle,
  onClose,
  menuRef,
}: HelpMenuContainerProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50" ref={menuRef}>
      <div className="relative">
        <HelpButton onClick={onToggle} isExpanded={isOpen} />
        {isOpen && (
          <HelpDropdown items={HELP_MENU_ITEMS} onItemClick={onClose} />
        )}
      </div>
    </div>
  );
}

function HelpButton({ onClick, isExpanded }: HelpButtonProps) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-primary-200/60 dark:border-primary-900 cursor-pointer dark:hover:bg-primary-900 bg-white/70 dark:bg-primary-900/70 backdrop-blur text-primary-700 dark:text-primary-200 hover:shadow-sm select-none transition-colors"
      aria-label="Help menu"
      aria-expanded={isExpanded}
      aria-haspopup="true"
      title="Help"
    >
      ?
    </button>
  );
}

interface HelpDropdownProps {
  items: readonly HelpMenuItem[];
  onItemClick: () => void;
}

function HelpDropdown({ items, onItemClick }: HelpDropdownProps) {
  return (
    <div className="absolute -bottom-3.5 right-0">
      <DropdownWrapper isOpen={true} position="right" openUpward={true}>
        {items.map((item) => (
          <HelpMenuItemLink key={item.href} item={item} onClick={onItemClick} />
        ))}
      </DropdownWrapper>
    </div>
  );
}

function HelpMenuItemLink({ item, onClick }: HelpMenuItemLinkProps) {
  return (
    <Link
      to={item.href}
      className="block w-full first:rounded-t-xl last:rounded-b-xl px-3 py-2 text-left hover:bg-primary-100 hover:shadow-sm dark:hover:bg-primary-700 transition-colors"
      onClick={onClick}
      role="menuitem"
    >
      <Body className="text-primary-700 dark:text-primary-200">
        {item.label}
      </Body>
    </Link>
  );
}

interface HelpMenuItem {
  label: string;
  href: string;
}

interface HelpMenuContainerProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
}

interface HelpButtonProps {
  onClick: () => void;
  isExpanded: boolean;
}

interface HelpMenuItemLinkProps {
  item: HelpMenuItem;
  onClick: () => void;
}
