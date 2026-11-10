import { join } from "node:path";
import { notFound } from "next/navigation";
import ActivityCard from "@/components/activity-card";
import { ContactForm } from "@/components/contact-form";
import {
  getMarkdownMetadata,
  getMarkdownParams,
  renderMarkdown,
} from "@/lib/markdown-content";

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
  const metadata = await getMarkdownMetadata(markdownDirectory, slug);

  return (
    <main className="markdown-page">
      <div className="activity-detail-card">
        <ActivityCard
          {...metadata}
          slug={slug}
          isCurrent
          detailBasePath="/more"
          tagBasePath="/more/tag"
        />
      </div>
      <article
        className="markdown-content"
        dangerouslySetInnerHTML={{ __html: content }}
      />
      <ContactForm />
    </main>
  );
}
