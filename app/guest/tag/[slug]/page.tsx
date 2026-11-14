import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { join } from "node:path";
import ActivityCard from "@/components/activity-card";
import { isDevAuthBypassEnabled } from "@/lib/auth";
import { getMarkdownParamsWithMetadata } from "@/lib/markdown-content";
import { getTagSlug } from "@/lib/tags";

const guestDirectory = join(process.cwd(), "content", "guest");
const tagSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function getGuestPages() {
  return getMarkdownParamsWithMetadata(guestDirectory, "slug");
}

export async function generateStaticParams() {
  const pages = await getGuestPages();
  const tagSlugs = new Set(
    pages.flatMap((page) => page.tags.map((tag) => getTagSlug(tag))),
  );

  return [...tagSlugs].sort().map((slug) => ({ slug }));
}

export default function GuestTagPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense
      fallback={      <main className="loading-page">Loading guest pages...</main>}
    >
      <GuestTagPageContent params={params} />
    </Suspense>
  );
}

async function GuestTagPageContent({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!isDevAuthBypassEnabled) {
    await auth.protect({ feature: "user:site_access" });
  }

  const { slug } = await params;
  if (!tagSlugPattern.test(slug)) {
    notFound();
  }

  const pages = await getGuestPages();
  const taggedPages = pages.filter((page) =>
    page.tags.some((tag) => getTagSlug(tag) === slug),
  );
  const tag = taggedPages
    .flatMap((page) => page.tags)
    .find((pageTag) => getTagSlug(pageTag) === slug);

  if (!tag || taggedPages.length === 0) {
    notFound();
  }

  return (
    <main className="activity-home">
      <div className="activity-heading">
        <p className="eyebrow">GUEST TAG</p>
        <h1>{tag}</h1>
        <p>Guest pages with this tag.</p>
      </div>
      <div className="activity-list-container">
        <p className="activity-count">
          {taggedPages.length}{" "}
          {taggedPages.length === 1 ? "page" : "pages"}
        </p>
        <ul className="activity-list">
          {taggedPages.map((page) => (
            <li key={page.slug}>
              <ActivityCard
                slug={page.slug}
                title={page.title}
                description={page.description}
                tags={page.tags}
                detailBasePath="/guest"
                tagBasePath="/guest/tag"
              />
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
