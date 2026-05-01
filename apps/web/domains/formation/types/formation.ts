export type FormationCategory =
  | "bases"
  | "channels"
  | "bankroll"
  | "leagues"
  | "app";

export const FORMATION_CATEGORIES: FormationCategory[] = [
  "bases",
  "channels",
  "bankroll",
  "leagues",
  "app",
];

export type FormationDifficulty = "beginner" | "intermediate" | "advanced";

export type FormationContentType = "article" | "video";

export type FormationChapter = {
  label: string;
  start: number;
};

export type FormationContentMeta = {
  type: FormationContentType;
  slug: string;
  title: string;
  category: FormationCategory;
  difficulty: FormationDifficulty;
  readTime: number;
  summary?: string;
  updatedAt?: string;
  videoUrl?: string;
  videoProvider?: "youtube" | "vimeo" | "html5";
  videoDuration?: string;
  chapters?: FormationChapter[];
  transcriptUrl?: string;
  thumbnail?: string;
  related?: string[];
};

export type FormationContentItem = FormationContentMeta & {
  content: string;
};
