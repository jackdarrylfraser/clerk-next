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

const guestDirectory = join(process.cwd(), "content", "guest");

export async function generateStaticParams() {
  return getMarkdownParams(guestDirectory, "slug");
}

async function GuestMarkdownPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!isDevAuthBypassEnabled) {
    await auth.protect({ feature: "user:site_access" });
  }

  const { slug } = await params;
  const content = await renderMarkdown(guestDirectory, slug);
  if (content === null) {
    notFound();
  }
  const metadata = await getMarkdownMetadata(guestDirectory, slug);

  return (
    <main className="markdown-page">
      <div className="activity-detail-card">
        <ActivityCard
          {...metadata}
          slug={slug}
          isCurrent
          detailBasePath="/guest"
          tagBasePath="/guest/tag"
        />
      </div>
      <article
        className="markdown-content"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </main>
  );
}

export default function GuestPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense
      fallback={      <main className="loading-page">Loading guest page...</main>}
    >
      <GuestMarkdownPage params={params} />
    </Suspense>
  );
}
