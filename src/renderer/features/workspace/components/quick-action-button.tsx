interface QuickActionButtonProps {
  label: string;
  onClick: () => void;
  hasArrow?: boolean;
}

export function QuickActionButton({ label, onClick, hasArrow }: QuickActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 text-sm glass-morphism-copilot text-primary-300 border! border-dashed! border-primary-700 rounded-xl hover:border-primary-500 hover:text-primary-200 hover:bg-primary-800/30 transition-all flex items-center gap-2"
    >
      <span>{label}</span>
      {hasArrow && <span className="text-primary-500">↗</span>}
    </button>
  );
}
