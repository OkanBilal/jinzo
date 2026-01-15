import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Close, Asterisk, Trash } from "@/components/ui/icons";
import Text, { Heading3 } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type {
    StructuredOutputSchema,
    StructuredOutputProperty,
} from "@/lib/redux/slices/chatSlice";
import Select from "../../ui/select";

interface StructuredOutputModalProps {
    isOpen: boolean;
    onClose: () => void;
    schema: StructuredOutputSchema;
    onSave: (schema: StructuredOutputSchema) => void;
}

const emptySubscribe = () => () => { };

export function StructuredOutputModal({
    isOpen,
    onClose,
    schema,
    onSave,
}: StructuredOutputModalProps) {
    const isBrowser = useSyncExternalStore(
        emptySubscribe,
        () => true,
        () => false
    );

    const [localProperties, setLocalProperties] = useState<
        StructuredOutputProperty[]
    >([]);
    const [initialized, setInitialized] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    if (isOpen && !initialized) {
        setLocalProperties(schema.properties);
        setInitialized(true);
    }

    if (!isOpen && initialized) {
        setInitialized(false);
    }

    const hasEmptyPropertyName = localProperties.some(
        (prop) => prop.name.trim() === ""
    );
    const canSave = localProperties.length === 0 || !hasEmptyPropertyName;

    const handleAddProperty = () => {
        setLocalProperties([
            ...localProperties,
            { name: "", type: "string", isArray: false, isRequired: false },
        ]);
    };

    const handleUpdateProperty = (
        index: number,
        updates: Partial<StructuredOutputProperty>
    ) => {
        const updated = [...localProperties];
        updated[index] = { ...updated[index], ...updates };
        setLocalProperties(updated);
    };

    const handleRemoveProperty = (index: number) => {
        setLocalProperties(localProperties.filter((_, i) => i !== index));
    };

    const handleReset = () => {
        setLocalProperties([]);
    };

    const handleSave = async () => {
        if (!canSave) return;
        setIsSaving(true);

        try {
            await Promise.all([
                new Promise((resolve) => setTimeout(resolve, 500)),
                (async () => {
                    onSave({ properties: localProperties });

                    if (localProperties.length === 0) {
                        await new Promise((resolve) => setTimeout(resolve, 100));
                    }
                })(),
            ]);

            onClose();
        } finally {
            setIsSaving(false);
        }
    };

    if (!isBrowser || !isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-100 flex items-center justify-center">
            <div
                className="absolute inset-0 bg-black/70 "
                onClick={onClose}
            />
            <div
                className="relative z-40 w-full max-w-200 bg-white/95 dark:bg-primary-900/95  border border-black/10 dark:border-white/10 rounded-3xl shadow-2xl"
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
                style={{
                    animation: "scaleIn 150ms ease-out",
                }}
            >
                <div className="flex items-center justify-between p-4">
                    <Heading3>Structured outputs</Heading3>
                    <button
                        onClick={onClose}
                        aria-label="Close modal"
                        className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full cursor-pointer text-primary-600 dark:text-primary-400 hover:bg-primary-200 dark:hover:bg-primary-800 transition-colors"
                    >
                        <Close className="w-4 h-4" />
                    </button>
                </div>
                <div className="p-4">
                    <div className="min-h-75 max-h-75 overflow-y-auto overflow-x-visible">
                        <div className="space-y-3 flex-col">
                            <Text className="uppercase tracking-wide">Property</Text>
                            {localProperties.map((prop, index) => (
                                <PropertyRow
                                    key={index}
                                    property={prop}
                                    onUpdate={(updates) => handleUpdateProperty(index, updates)}
                                    onRemove={() => handleRemoveProperty(index)}
                                />
                            ))}
                            <Button onClick={handleAddProperty} variant="secondary">
                                + Add property
                            </Button>
                        </div>
                    </div>
                </div>
                <div className="flex items-center justify-end gap-3 p-4 border-t border-black/5 dark:border-white/10">
                    <Button onClick={handleReset} variant="ghost" size="sm">
                        Reset
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={!canSave}
                        isLoading={isSaving}
                        variant="primary"
                        size="sm"
                    >
                        Save
                    </Button>
                </div>
            </div>
        </div>,
        document.body
    );
}

interface PropertyRowProps {
    property: StructuredOutputProperty;
    onUpdate: (updates: Partial<StructuredOutputProperty>) => void;
    onRemove: () => void;
}

function PropertyRow({ property, onUpdate, onRemove }: PropertyRowProps) {
    const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);

    const typeOptions = [
        { value: "string", label: "string" },
        { value: "number", label: "number" },
        { value: "boolean", label: "boolean" },
        { value: "array", label: "array" },
        { value: "object", label: "object" },
    ];

    const isNameEmpty = property.name.trim() === "";

    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
                <Input
                    type="text"
                    value={property.name}
                    onChange={(e) => onUpdate({ name: e.target.value })}
                    placeholder="Property name"
                    hasError={isNameEmpty}
                    className="w-full rounded-xl!"
                />
            </div>
            <div className="w-32 shrink-0">
                <Select
                    value={property.type}
                    options={typeOptions}
                    onChange={(val) =>
                        onUpdate({
                            type: val as StructuredOutputProperty["type"],
                        })
                    }
                    placeholder="Type"
                />
            </div>
            <button
                onClick={() => onUpdate({ isArray: !property.isArray })}
                className={`shrink-0 px-2.5 py-2 border-none rounded-xl text-sm transition-all ${property.isArray
                        ? "bg-black/8 dark:bg-white/12 text-primary-800 dark:text-primary-200"
                        : "bg-black/3 dark:bg-white/5 text-primary-500 dark:text-primary-400"
                    }`}
                title="Is Array"
            >
                [ ]
            </button>
            <button
                onClick={() => onUpdate({ isRequired: !property.isRequired })}
                className={`shrink-0 py-2.5 px-2 border-none rounded-xl text-sm transition-all ${property.isRequired
                        ? "bg-black/8 dark:bg-white/12 text-primary-800 dark:text-primary-200"
                        : "bg-black/3 dark:bg-white/5 text-primary-500 dark:text-primary-400"
                    }`}
                title="Required"
            >
                <Asterisk className="w-4 h-4" />
            </button>
            <button
                onClick={onRemove}
                className="shrink-0 p-2 text-primary-500 cursor-pointer hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                title="Remove"
            >
                <Trash className="w-4 h-4" />
            </button>
        </div>
    );
}
