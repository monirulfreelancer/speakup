/*
 * The fixed interest vocabulary. Defined once here and used by the profile
 * editor, the directory chips and (later) matching — free text would make
 * two people who both like films unfindable to each other.
 *
 * `value` is what is stored; `label` is what is shown. Never rename a value
 * without a data migration.
 */

export const INTERESTS = [
  { value: "travel", label: "Travel" },
  { value: "movies", label: "Movies" },
  { value: "music", label: "Music" },
  { value: "sports", label: "Sports" },
  { value: "food", label: "Food" },
  { value: "technology", label: "Technology" },
  { value: "business", label: "Business" },
  { value: "study-abroad", label: "Study abroad" },
  { value: "daily-life", label: "Daily life" },
  { value: "news", label: "News" },
  { value: "books", label: "Books" },
  { value: "gaming", label: "Gaming" },
  { value: "health", label: "Health" },
  { value: "culture", label: "Culture" },
] as const;

export const MAX_INTERESTS = 5;
export const MAX_BIO_LENGTH = 200;

export const INTEREST_VALUES = INTERESTS.map((i) => i.value);

export function interestLabel(value: string): string {
  return INTERESTS.find((i) => i.value === value)?.label ?? value;
}
