import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

interface AnimatedTitleProps {
  title: string;
  className?: string;
}

export function AnimatedTitle({ title, className = "" }: AnimatedTitleProps) {
  const [hasChanged, setHasChanged] = useState(false);
  const initialTitleRef = useRef(title);

  useEffect(() => {
    // Only trigger animation if the title changed from the initial value
    if (title !== initialTitleRef.current && !hasChanged) {
      setHasChanged(true);
    }
  }, [title, hasChanged]);

  // No animation until title has been regenerated
  if (!hasChanged) {
    return <span className={className}>{title}</span>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={title}
        className={className}
        style={{ display: "block" }}
        initial={{
          clipPath: "inset(0 100% 0 0)",
          filter: "blur(6px)",
          opacity: 0,
        }}
        animate={{
          clipPath: "inset(0 0% 0 0)",
          filter: "blur(0px)",
          opacity: 1,
        }}
        exit={{
          clipPath: "inset(0 0 0 100%)",
          filter: "blur(6px)",
          opacity: 0,
        }}
        transition={{
          duration: 0.35,
          ease: [0.4, 0, 0.2, 1],
        }}
      >
        {title}
      </motion.span>
    </AnimatePresence>
  );
}
