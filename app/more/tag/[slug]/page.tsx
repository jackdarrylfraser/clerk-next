import { notFound } from "next/navigation";
import { Suspense } from "react";
import { join } from "node:path";
import ActivityCard from "@/components/activity-card";
import { getMarkdownParamsWithMetadata } from "@/lib/markdown";
import { getTagSlug } from "@/lib/tags";

const markdownDirectory = join(process.cwd(), "content", "markdown");
const tagSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function getPages() {
  return getMarkdownParamsWithMetadata(markdownDirectory, "slug");
}

export async function generateStaticParams() {
  const pages = await getPages();
  const tagSlugs = new Set(
    pages.flatMap((page) => page.tags.map((tag) => getTagSlug(tag))),
  );

  return [...tagSlugs].sort().map((slug) => ({ slug }));
}

export default function MoreTagPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense fallback={<main className="loading-page">Loading pages...</main>}>
      <MoreTagPageContent params={params} />
    </Suspense>
  );
}

async function MoreTagPageContent({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!tagSlugPattern.test(slug)) {
    notFound();
  }

  const pages = await getPages();
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
        <p className="eyebrow">PAGE TAG</p>
        <h1>{tag}</h1>
        <p>Pages with this tag.</p>
      </div>
      <div className="activity-list-container">
        <p className="activity-count">
          {taggedPages.length} {taggedPages.length === 1 ? "page" : "pages"}
        </p>
        <ul className="activity-list">
          {taggedPages.map((page) => (
            <li key={page.slug}>
              <ActivityCard
                slug={page.slug}
                title={page.title}
                description={page.description}
                tags={page.tags}
                detailBasePath="/more"
                tagBasePath="/more/tag"
              />
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
