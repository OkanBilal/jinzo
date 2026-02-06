
export default function ChatLoadingFallback() {
  return (
    <div className="min-h-screen w-full px-4 flex items-center justify-center">
      <div className="text-center">
        <div className="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-12 w-12 mx-auto mb-4"></div>
        <p className="text-lg text-primary-700 dark:text-primary-300">Loading chat...</p>
      </div>
    </div>
  );
}
