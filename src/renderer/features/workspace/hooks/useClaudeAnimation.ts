import { useState, useEffect } from "react";

const symbols = ["·", "✢", "✳", "✶", "✻", "✽"];
const words = [
  "Accomplishing",
  "Actioning",
  "Actualizing",
  "Baking",
  "Booping",
  "Brewing",
  "Calculating",
  "Cerebrating",
  "Channelling",
  "Churning",
  "Clauding",
  "Coalescing",
  "Cogitating",
  "Computing",
  "Combobulating",
  "Concocting",
  "Considering",
  "Contemplating",
  "Cooking",
  "Crafting",
  "Creating",
  "Crunching",
  "Deciphering",
  "Deliberating",
  "Determining",
  "Discombobulating",
  "Doing",
  "Effecting",
  "Elucidating",
  "Enchanting",
  "Envisioning",
  "Finagling",
  "Flibbertigibbeting",
  "Forging",
  "Forming",
  "Frolicking",
  "Generating",
  "Germinating",
  "Hatching",
  "Herding",
  "Honking",
  "Ideating",
  "Imagining",
  "Incubating",
  "Inferring",
  "Manifesting",
  "Marinating",
  "Meandering",
  "Moseying",
  "Mulling",
  "Mustering",
  "Musing",
  "Noodling",
  "Percolating",
  "Perusing",
  "Philosophising",
  "Pontificating",
  "Pondering",
  "Processing",
  "Puttering",
  "Puzzling",
  "Reticulating",
  "Ruminating",
  "Scheming",
  "Schlepping",
  "Shimmying",
  "Simmering",
  "Smooshing",
  "Spelunking",
  "Spinning",
  "Stewing",
  "Sussing",
  "Synthesizing",
  "Thinking",
  "Tinkering",
  "Transmuting",
  "Unfurling",
  "Unravelling",
  "Vibing",
  "Wandering",
  "Whirring",
  "Wibbling",
  "Working",
  "Wrangling",
];

export function useClaudeAnimation(enabled: boolean) {
  const [symbol, setSymbol] = useState(symbols[0]);
  const [word, setWord] = useState(() => words[Math.floor(Math.random() * words.length)]);

  useEffect(() => {
    if (!enabled) return;

    let symbolIndex = 0;
    let directionUp = true;

    const symbolInterval = setInterval(() => {
      setSymbol(symbols[symbolIndex]);

      if (symbolIndex >= symbols.length - 1) {
        directionUp = false;
      } else if (symbolIndex <= 0) {
        directionUp = true;
      }

      if (directionUp) {
        symbolIndex++;
      } else {
        symbolIndex--;
      }
    }, 250);

    const wordInterval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * words.length);
      setWord(words[randomIndex]);
    }, 3000);

    return () => {
      clearInterval(symbolInterval);
      clearInterval(wordInterval);
    };
  }, [enabled]);

  return { symbol, word };
}
