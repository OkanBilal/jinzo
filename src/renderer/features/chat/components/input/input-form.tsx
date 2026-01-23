import { InputFormProps } from "./types";

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
        className="rounded-3xl w-full  dark:text-primary-200 text-primary-700  px-6 py-5 
        placeholder:text-primary-500 dark:placeholder:text-primary-600 placeholder:text-md outline-none"
      />
    </form>
  );
}
