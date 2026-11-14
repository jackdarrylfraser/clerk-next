import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { join } from "node:path";
import ActivityCard from "@/components/activity-card";
import { isDevAuthBypassEnabled } from "@/lib/auth";
import {
  getMarkdownMetadata,
  getMarkdownParams,
  renderMarkdown,
} from "@/lib/markdown-content";

const starterDirectory = join(process.cwd(), "content", "starter");

export async function generateStaticParams() {
  return getMarkdownParams(starterDirectory, "slug");
}

async function StarterMarkdownPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!isDevAuthBypassEnabled) {
    await auth.protect({ feature: "user:site_access" });
  }

  const { slug } = await params;
  const content = await renderMarkdown(starterDirectory, slug);
  if (content === null) {
    notFound();
  }
  const metadata = await getMarkdownMetadata(starterDirectory, slug);

  return (
    <main className="markdown-page">
      <div className="activity-detail-card">
        <ActivityCard
          {...metadata}
          slug={slug}
          isCurrent
          detailBasePath="/starter"
          tagBasePath="/starter/tag"
        />
      </div>
      <article
        className="markdown-content"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </main>
  );
}

export default function StarterPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense
      fallback={<main className="loading-page">Loading starter page...</main>}
    >
      <StarterMarkdownPage params={params} />
    </Suspense>
  );
}
