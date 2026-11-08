import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { join } from "node:path";
import { getMarkdownParams, renderMarkdown } from "@/lib/markdown";

const activityDirectory = join(process.cwd(), "content", "activity");

export async function generateStaticParams() {
  return getMarkdownParams(activityDirectory, "content");
}

async function PermissionedActivityPage({
  params,
}: {
  params: Promise<{ content: string }>;
}) {
  await auth.protect({ feature: "user:site_access" });

  const { content: slug } = await params;
  const renderedContent = await renderMarkdown(activityDirectory, slug);
  if (renderedContent === null) {
    notFound();
  }

  return (
    <main className="markdown-page">
      <article
        className="markdown-content"
        dangerouslySetInnerHTML={{ __html: renderedContent }}
      />
    </main>
  );
}

export default function ActivityPage({
  params,
}: {
  params: Promise<{ content: string }>;
}) {
  return (
    <Suspense fallback={<main className="loading-page">Loading activity...</main>}>
      <PermissionedActivityPage params={params} />
    </Suspense>
  );
}
