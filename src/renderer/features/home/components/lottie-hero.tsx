import type { ComponentProps } from "react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

export default function LottieHero({
  autoplay = true,
  loop = true,
}: LottieHeroProps) {
  return (
    <div
      className="w-60 h-60 animate-[blur-reveal_1s_ease-out_forwards] blur-lg opacity-0"
      aria-hidden="true"
    >
      <DotLottieReact
        src="/gradient.json"
        autoplay={autoplay}
        loop={loop}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}

type LottieHeroProps = {
  src?: string;
  className?: string;
  sizeClassName?: string;
} & Pick<ComponentProps<typeof DotLottieReact>, "autoplay" | "loop">;
