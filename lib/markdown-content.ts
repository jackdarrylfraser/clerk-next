import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import { renderMarkdown as renderMarkdownSource } from "@clerk-next/markdown-engine";
import { getTagSlug } from "@/lib/tags";

const slugPattern = /^[a-z0-9_-]+$/i;

export async function getMarkdownParams<Parameter extends string>(
  directory: string,
  parameter: Parameter,
): Promise<Array<Record<Parameter, string>>> {
  const entries = await readdir(directory, { withFileTypes: true });

  return entries
    .filter((entry) => {
      if (!entry.isFile() || !entry.name.endsWith(".md")) {
        return false;
      }

      return slugPattern.test(entry.name.slice(0, -3));
    })
    .map(
      (entry) =>
        ({ [parameter]: entry.name.slice(0, -3) }) as Record<Parameter, string>,
    )
    .sort((a, b) => a[parameter].localeCompare(b[parameter]));
}

export async function getMarkdownParamsWithMetadata<Parameter extends string>(
  directory: string,
  parameter: Parameter,
): Promise<
  Array<Record<Parameter, string> & { title: string; description: string; tags: string[] }>
> {
  const params = await getMarkdownParams(directory, parameter);
  return Promise.all(
    params.map(async (entry) => ({
      ...entry,
      ...(await getMarkdownMetadata(directory, entry[parameter])),
    })),
  );
}

export async function getMarkdownMetadata(
  directory: string,
  slug: string,
): Promise<{ title: string; description: string; tags: string[] }> {
  const source = await readFile(join(directory, `${slug}.md`), "utf8");
  const { data } = matter(source);
  const frontmatterTitle =
    typeof data.title === "string" ? data.title.trim() : "";
  const frontmatterDescription =
    typeof data.description === "string" ? data.description.trim() : "";
  const frontmatterTags = Array.isArray(data.tags)
    ? data.tags.map((tag) => (typeof tag === "string" ? tag.trim() : ""))
    : [];
  const missingFields = [
    !frontmatterTitle && "title",
    !frontmatterDescription && "description",
    (!frontmatterTags.length ||
      frontmatterTags.some((tag) => !tag || !getTagSlug(tag))) &&
      "tags",
  ].filter((field): field is string => Boolean(field));

  if (missingFields.length) {
    throw new Error(
      `Invalid markdown metadata in ${join(directory, `${slug}.md`)}: required frontmatter is missing or invalid for ${missingFields.join(", ")}.`,
    );
  }

  return {
    title: frontmatterTitle,
    description: frontmatterDescription,
    tags: frontmatterTags,
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

  return renderMarkdownSource(matter(source).content);
}
