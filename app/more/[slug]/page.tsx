import { join } from "node:path";
import { notFound } from "next/navigation";
import { getMarkdownParams, renderMarkdown } from "@/lib/markdown";

const markdownDirectory = join(process.cwd(), "content", "markdown");

export const instant = false;

export async function generateStaticParams() {
  return getMarkdownParams(markdownDirectory, "slug");
}

export default async function PublicMarkdownPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const content = await renderMarkdown(markdownDirectory, slug);
  if (content === null) {
    notFound();
  }

  return (
    <main className="markdown-page">
      <article
        className="markdown-content"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </main>
  );
}
