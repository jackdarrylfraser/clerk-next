import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, {
  defaultSchema,
  type Options,
} from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import { getTagSlug } from "@/lib/tags";

const slugPattern = /^[a-z0-9_-]+$/i;
const markdownSanitizeSchema: Options = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [
      ...(defaultSchema.attributes?.code ?? []),
      ["className", "math-inline", "math-display"],
    ],
  },
};

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

export async function getActivityMarkdownParams(
  directory: string,
  parameter: string,
): Promise<Record<string, string>[]> {
  const params = await getMarkdownParams(directory, parameter);
  await Promise.all(
    params.map((entry) => getMarkdownMetadata(directory, entry[parameter])),
  );
  return params;
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
      `Invalid activity metadata in ${join(directory, `${slug}.md`)}: required frontmatter is missing or invalid for ${missingFields.join(", ")}.`,
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

  return String(
    await remark()
      .use(remarkGfm)
      .use(remarkMath)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeRaw)
      .use(rehypeSanitize, markdownSanitizeSchema)
      .use(rehypeKatex)
      .use(rehypeStringify)
      .process(matter(source).content),
  );
}
