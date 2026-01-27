
export default function InputForm({
  query,
  onQueryChange,
  onSubmit,
  placeholder,
}: InputFormProps) {
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
        className="rounded-3xl w-full dark:text-copilot-lightblue text-primary-700  px-6 py-5 
        placeholder:text-primary-500 dark:placeholder:text-copilot-lightblue/40 placeholder:text-md outline-none"
      />
    </form>
  );
}

interface InputFormProps {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
}
