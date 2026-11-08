import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { notFound } from "next/navigation";
import { remark } from "remark";
import html from "remark-html";

const markdownDirectory = join(process.cwd(), "content", "markdown");

export const instant = false;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const files = await readdir(markdownDirectory);
  return files
    .filter((file) => /^[a-z0-9_-]+\.md$/i.test(file))
    .map((file) => ({ slug: file.slice(0, -3) }));
}

export default async function MarkdownPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!/^[a-z0-9_-]+$/i.test(slug)) {
    notFound();
  }

  let markdown: string;
  try {
    markdown = await readFile(join(markdownDirectory, `${slug}.md`), "utf8");
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      notFound();
    }
    throw error;
  }

  const content = await remark().use(html).process(markdown);

  return (
    <main className="markdown-page">
      <article
        className="markdown-content"
        dangerouslySetInnerHTML={{ __html: String(content) }}
      />
    </main>
  );
}
