import { feedItems } from "../schema";
import { getDb, initializeDatabase } from "../client";

const sampleFeedItems = [
  {
    title: "TypeScript 5.4 Released with New Features",
    url: "https://devblogs.microsoft.com/typescript/announcing-typescript-5-4",
    description: "Microsoft announces TypeScript 5.4 with improved type inference and performance optimizations.",
    itemType: "article",
    date: new Date(Date.now() - 86400000 * 2), // 2 days ago
    source: "microsoft",
    imageUrl: "https://devblogs.microsoft.com/typescript/wp-content/uploads/sites/11/2024/01/typescript-5-4.png",
    metadata: JSON.stringify({
      author: "Daniel Rosenwasser",
      tags: ["typescript", "release", "programming"],
    }),
  },
  {
    title: "Electron 29 Brings Major Performance Improvements",
    url: "https://www.electronjs.org/blog/electron-29-0",
    description: "The latest Electron release includes Chrome 122 and Node.js 20, with significant performance enhancements.",
    itemType: "article",
    date: new Date(Date.now() - 86400000 * 5), // 5 days ago
    source: "electron",
    imageUrl: null,
    metadata: JSON.stringify({
      version: "29.0.0",
      tags: ["electron", "release"],
    }),
  },
  {
    title: "Building Modern Desktop Apps with React",
    url: "https://example.com/react-desktop-apps",
    description: "A comprehensive guide to building cross-platform desktop applications using React and Electron.",
    itemType: "tutorial",
    date: new Date(Date.now() - 86400000 * 7), // 1 week ago
    source: "dev.to",
    imageUrl: null,
    metadata: JSON.stringify({
      author: "Jane Developer",
      readTime: "15 min",
      tags: ["react", "electron", "tutorial"],
    }),
  },
  {
    title: "Drizzle ORM v0.30 - Better SQLite Support",
    url: "https://github.com/drizzle-team/drizzle-orm/releases/tag/0.30.0",
    description: "Enhanced SQLite support with better type inference and migration tools.",
    itemType: "release",
    date: new Date(Date.now() - 86400000 * 10), // 10 days ago
    source: "github",
    imageUrl: null,
    metadata: JSON.stringify({
      repository: "drizzle-team/drizzle-orm",
      version: "0.30.0",
      tags: ["database", "orm", "sqlite"],
    }),
  },
  {
    title: "Vite 5.0 - Next Generation Frontend Tooling",
    url: "https://vitejs.dev/blog/announcing-vite5",
    description: "Vite 5.0 is here with Rollup 4, improved performance, and new APIs.",
    itemType: "article",
    date: new Date(Date.now() - 86400000 * 14), // 2 weeks ago
    source: "vitejs",
    imageUrl: null,
    metadata: JSON.stringify({
      author: "Evan You",
      tags: ["vite", "build-tools", "frontend"],
    }),
  },
  {
    title: "Tailwind CSS v4.0 Beta - Revolutionary Changes",
    url: "https://tailwindcss.com/blog/tailwindcss-v4-beta",
    description: "Tailwind CSS v4 introduces a new engine, improved performance, and exciting new features.",
    itemType: "article",
    date: new Date(Date.now() - 86400000 * 1), // yesterday
    source: "tailwindcss",
    imageUrl: null,
    metadata: JSON.stringify({
      version: "4.0.0-beta",
      tags: ["css", "tailwind", "frontend"],
    }),
  },
  {
    title: "React 19 RC - What's New",
    url: "https://react.dev/blog/2024/12/05/react-19",
    description: "React 19 brings the new React Compiler, Actions, and many other improvements.",
    itemType: "article",
    date: new Date(Date.now() - 86400000 * 3), // 3 days ago
    source: "react",
    imageUrl: null,
    metadata: JSON.stringify({
      author: "React Team",
      tags: ["react", "release", "javascript"],
    }),
  },
  {
    title: "State of JavaScript 2024 Survey Results",
    url: "https://stateofjs.com/en-US",
    description: "The annual State of JavaScript survey results are in, revealing the latest trends in the JS ecosystem.",
    itemType: "report",
    date: new Date(Date.now() - 86400000 * 20), // 20 days ago
    source: "stateofjs",
    imageUrl: null,
    metadata: JSON.stringify({
      year: 2024,
      tags: ["survey", "javascript", "trends"],
    }),
  },
];

export async function seedFeedItems(): Promise<void> {
  // Ensure DB is initialized
  await initializeDatabase();

  const db = getDb();

  console.log(`🌱 Seeding ${sampleFeedItems.length} feed items...`);

  for (const item of sampleFeedItems) {
    try {
      await db
        .insert(feedItems)
        .values(item)
        .onConflictDoNothing()
        .run?.();
    } catch (error) {
      console.error(`Failed to insert item: ${item.title}`, error);
    }
  }

  console.log(`✅ Successfully seeded ${sampleFeedItems.length} feed items!`);
}

// Allow running this file directly
if (process.argv[1]?.includes("seed-feed-items")) {
  seedFeedItems()
    .then(() => {
      console.log("\n✨ Seeding completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Seeding failed:", error);
      process.exit(1);
    });
}
