import { Text, Muted, ErrorText, Caption, Button, Input } from "@/components/ui";

interface CredentialField {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "password" | "email";
  helperText?: string;
  required?: boolean;
}

interface CredentialStepProps {
  description: string;
  fields: CredentialField[];
  instructions?: React.ReactNode;
  onSubmit: () => void;
  loading: boolean;
  error: string;
  submitLabel?: string;
  loadingLabel?: string;
}

export function CredentialStep({
  description,
  fields,
  instructions,
  onSubmit,
  loading,
  error,
  submitLabel = "Continue",
  loadingLabel = "Connecting...",
}: CredentialStepProps) {
  const allFieldsFilled = fields.every((field) => field.required === false || field.value.trim());

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && allFieldsFilled && !loading) {
      onSubmit();
    }
  };

  return (
    <div className="space-y-4">
      <Muted>{description}</Muted>

      {fields.map((field, index) => (
        <div key={field.id}>
          <label htmlFor={field.id} className="block mb-2 ml-1">
            <Text variant="label" className="text-xs!">{field.label}</Text>
          </label>
          <Input
            id={field.id}
            type={field.type || "password"}
            value={field.value}
            onChange={(e) => field.onChange(e.target.value)}
            placeholder={field.placeholder}
            disabled={loading}
            onKeyDown={index === fields.length - 1 ? handleKeyDown : undefined}
          />
          {field.helperText && (
            <p className="text-xs text-primary-500 dark:text-primary-400 mt-1">{field.helperText}</p>
          )}
        </div>
      ))}

      {instructions && (
        <div className="mt-4 px-2 py-2 bg-primary dark:bg-primary-900 rounded-xl text-sm">
          <Caption>{instructions}</Caption>
        </div>
      )}

      {error && <ErrorText>{error}</ErrorText>}

      <div className="flex justify-end gap-3 pt-2">
        <Button
          variant="submit"
          onClick={onSubmit}
          disabled={loading || !allFieldsFilled}
          isLoading={loading}
        >
          {loading ? loadingLabel : submitLabel}
        </Button>
      </div>
    </div>
  );
}
