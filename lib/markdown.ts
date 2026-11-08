import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import { remark } from "remark";
import html from "remark-html";
import { getTagSlug } from "@/lib/tags";

const slugPattern = /^[a-z0-9_-]+$/i;

export async function getMarkdownParams(
  directory: string,
  parameter: string,
): Promise<Record<string, string>[]> {
  const entries = await readdir(directory, { withFileTypes: true });

  return entries
    .filter((entry) => {
      if (!entry.isFile() || !entry.name.endsWith(".md")) {
        return false;
      }

      return slugPattern.test(entry.name.slice(0, -3));
    })
    .map((entry) => ({ [parameter]: entry.name.slice(0, -3) }))
    .sort((a, b) => a[parameter].localeCompare(b[parameter]));
}

export async function getMarkdownMetadata(
  directory: string,
  slug: string,
): Promise<{ title: string; description?: string; tags?: string[] }> {
  const source = await readFile(join(directory, `${slug}.md`), "utf8");
  const { content, data } = matter(source);
  const frontmatterTitle =
    typeof data.title === "string" ? data.title.trim() : "";
  const frontmatterDescription =
    typeof data.description === "string" ? data.description.trim() : "";
  const frontmatterTags = Array.isArray(data.tags)
    ? data.tags.filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim())
        .filter((tag) => tag && getTagSlug(tag))
    : [];
  const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();

  return {
    title:
      frontmatterTitle ||
      heading ||
      slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase()),
    ...(frontmatterDescription ? { description: frontmatterDescription } : {}),
    ...(frontmatterTags.length > 0 ? { tags: frontmatterTags } : {}),
  };
}

export async function renderMarkdown(
  directory: string,
  slug: string,
): Promise<string | null> {
  if (!slugPattern.test(slug)) {
    return null;
  }

  let source: string;
  try {
    source = await readFile(join(directory, `${slug}.md`), "utf8");
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return null;
    }
    throw error;
  }

  return String(await remark().use(html).process(matter(source).content));
}
