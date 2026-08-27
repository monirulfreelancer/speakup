// Local development seed: the 8 starter conversation topics.
// Idempotent — upserts by slug, so re-running never duplicates.

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const topics = [
  {
    slug: "daily-routine",
    title: "Daily Routine",
    description: "Talk about your typical day, from morning to night.",
    icon: "☀️",
    minLevel: "A1",
    maxLevel: "B1",
    promptSeed:
      "Ask the learner what time they usually wake up and what they do first in the morning.",
    sortOrder: 1,
  },
  {
    slug: "travel",
    title: "Travel",
    description: "Places you have visited or dream of visiting.",
    icon: "✈️",
    minLevel: "A2",
    maxLevel: "C2",
    promptSeed:
      "Ask the learner about the most interesting place they have ever visited and why it stayed with them.",
    sortOrder: 2,
  },
  {
    slug: "food-restaurants",
    title: "Food & Restaurants",
    description: "Favourite dishes, cooking, and eating out.",
    icon: "🍜",
    minLevel: "A1",
    maxLevel: "B2",
    promptSeed:
      "Ask the learner what their favourite meal is and whether they cook it themselves.",
    sortOrder: 3,
  },
  {
    slug: "job-interview",
    title: "Job Interview",
    description: "Practice answering common interview questions.",
    icon: "💼",
    minLevel: "B1",
    maxLevel: "C2",
    promptSeed:
      "Play the role of a friendly interviewer. Start by asking the learner to tell you a little about themselves.",
    sortOrder: 4,
  },
  {
    slug: "shopping",
    title: "Shopping",
    description: "Buying things, prices, and shops.",
    icon: "🛍️",
    minLevel: "A1",
    maxLevel: "B1",
    promptSeed:
      "Ask the learner about the last thing they bought and whether it was a good purchase.",
    sortOrder: 5,
  },
  {
    slug: "hobbies-free-time",
    title: "Hobbies & Free Time",
    description: "What you love doing when you're not working.",
    icon: "🎨",
    minLevel: "A1",
    maxLevel: "C1",
    promptSeed:
      "Ask the learner what they enjoy doing at the weekend and how they got into it.",
    sortOrder: 6,
  },
  {
    slug: "health-fitness",
    title: "Health & Fitness",
    description: "Exercise, sleep, food and feeling good.",
    icon: "💪",
    minLevel: "A2",
    maxLevel: "C1",
    promptSeed:
      "Ask the learner whether they do any exercise and what keeps them motivated — or what stops them.",
    sortOrder: 7,
  },
  {
    slug: "technology",
    title: "Technology",
    description: "Phones, apps, AI and how tech changes life.",
    icon: "📱",
    minLevel: "B1",
    maxLevel: "C2",
    promptSeed:
      "Ask the learner which app they use the most and how life would change without it.",
    sortOrder: 8,
  },
] as const;

async function main() {
  for (const t of topics) {
    await db.topic.upsert({
      where: { slug: t.slug },
      update: { ...t },
      create: { ...t },
    });
  }
  console.log(`Seeded ${topics.length} topics.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
