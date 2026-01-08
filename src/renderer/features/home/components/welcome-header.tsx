"use client";

import { Heading1 } from "../../../components/ui/text";

const DEFAULT_SUBTITLE = "What are you working on?";

export default function WelcomeHeader({ subtitle }: WelcomeHeaderProps) {
  const displaySubtitle = subtitle ?? DEFAULT_SUBTITLE;

  return (
    <div className="w-full" role="banner">
      <Heading1 
        align="center" 
        className="animate-[blur-reveal_1s_ease-out_forwards] blur-lg opacity-0"
      >
        {displaySubtitle}
      </Heading1>
    </div>
  );
}

interface WelcomeHeaderProps {
  subtitle?: string;
}
