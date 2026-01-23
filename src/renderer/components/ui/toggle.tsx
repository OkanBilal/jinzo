import { Button } from "./button";

interface ToggleProps {
    enabled: boolean;
    onChange: (enabled: boolean) => void;
    label?: string;
    className?: string;
}

export function Toggle({ enabled, onChange, label, className = "" }: ToggleProps) {
    return (
        <div className={`flex items-center justify-between py-2 ${className}`}>
            {label && (
                <div className="flex flex-col">
                    <span className="text-sm text-primary-800 dark:text-primary-200">
                        {label}
                    </span>
                </div>
            )}
            <Button
                onClick={() => onChange(!enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all shadow-[inset_0_0.5px_2px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_0.5px_2px_rgba(0,0,0,0.3)] ${enabled
                        ? "bg-blue-500 dark:bg-blue-600"
                        : "bg-black/8 dark:bg-white/15"
                    }`}
            >
                <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${enabled ? "translate-x-5.5" : "translate-x-0.5"
                        }`}
                />
            </Button>
        </div>
    );
}
