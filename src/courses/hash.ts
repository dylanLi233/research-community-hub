export type CourseHashInput = {
  title: string;
  subtitle: string | null;
  slug: string;
  summary: string;
  descriptionHtml: string;
  coverAssetId: string | null;
  instructorName: string | null;
  tags: string[];
  accessLevel: "public" | "member" | "private";
  seoTitle: string | null;
  seoDescription: string | null;
};

export type ChapterHashInput = {
  title: string;
  slug: string;
  summary: string;
  bodyHtml: string;
  accessLevel: "public" | "member" | "private";
  previewMode: "none" | "paywall_marker" | "summary_only";
  position: number;
  estimatedMinutes: number | null;
};

async function sha256Json(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(value)),
  );

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function hashCourseContent(input: CourseHashInput): Promise<string> {
  return sha256Json(input);
}

export function hashChapterContent(input: ChapterHashInput): Promise<string> {
  return sha256Json(input);
}
