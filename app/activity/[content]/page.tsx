import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { join } from "node:path";
import { isDevAuthBypassEnabled } from "@/lib/auth";
import ActivityCard from "@/components/activity-card";
import {
  getMarkdownMetadata,
  getMarkdownParamsWithMetadata,
  renderMarkdown,
} from "@/lib/markdown";

const activityDirectory = join(process.cwd(), "content", "activity");

export async function generateStaticParams() {
  const pages = await getMarkdownParamsWithMetadata(
    activityDirectory,
    "content",
  );
  return pages.map(({ content }) => ({ content }));
}

async function PermissionedActivityPage({
  params,
}: {
  params: Promise<{ content: string }>;
}) {
  if (!isDevAuthBypassEnabled) {
    await auth.protect({ feature: "user:site_access" });
  }

  const { content: slug } = await params;
  const renderedContent = await renderMarkdown(activityDirectory, slug);
  if (renderedContent === null) {
    notFound();
  }
  const metadata = await getMarkdownMetadata(activityDirectory, slug);

  return (
    <main className="markdown-page">
      <div className="activity-detail-card">
        <ActivityCard {...metadata} slug={slug} isCurrent />
      </div>
      <article
        className="markdown-content activity-content"
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
