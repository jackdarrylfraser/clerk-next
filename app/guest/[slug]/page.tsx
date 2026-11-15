import { notFound } from "next/navigation";
import { Suspense } from "react";
import { join } from "node:path";
import ActivityCard from "@/components/activity-card";
import { GuestEmailVerificationGate } from "@/components/guest-email-verification-gate";
import { isDevAuthBypassEnabled } from "@/lib/auth";
import { hasGuestContentAccess } from "@/lib/lead/guest-access";
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
  const { slug } = await params;
  if (!isDevAuthBypassEnabled) {
    if (!(await hasGuestContentAccess())) {
      const pageExists = (await getMarkdownParams(guestDirectory, "slug")).some(
        (page) => page.slug === slug,
      );
      const title = pageExists
        ? (await getMarkdownMetadata(guestDirectory, slug)).title
        : undefined;

      return (
        <GuestEmailVerificationGate
          returnTo={`/guest/${encodeURIComponent(slug)}`}
          title={title}
        />
      );
    }
  }

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
