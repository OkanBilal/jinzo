import type { InputVariant } from "./send-button";

interface InputFormProps {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  variant?: InputVariant;
}

const variantStyles = {
  default: {
    input: "dark:text-primary-200 text-primary-700 placeholder:text-primary-500 dark:placeholder:text-primary-600",
  },
  copilot: {
    input: "dark:text-copilot-lightblue text-primary-700 placeholder:text-primary-500 dark:placeholder:text-copilot-lightblue/60",
  },
  claude: {
    input: "dark:text-claude-light text-primary-700 placeholder:text-primary-500 dark:placeholder:text-claude-light/60",
  },
};

export function InputForm({
  query,
  onQueryChange,
  onSubmit,
  placeholder,
  variant = "default",
}: InputFormProps) {
  const styles = variantStyles[variant];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      aria-label="Feed input form"
    >
      <input
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder={placeholder}
        className={`rounded-3xl w-full px-6 py-5 placeholder:text-md outline-none ${styles.input}`}
      />
    </form>
  );
}
