import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { remark } from "remark";
import html from "remark-html";

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
    .map((entry) => ({ [parameter]: entry.name.slice(0, -3) }));
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

  return String(await remark().use(html).process(source));
}
