import Link from "next/link";
import { join } from "node:path";
import { Suspense } from "react";
import ActivityCard from "@/components/activity-card";
import { getMarkdownParamsWithMetadata } from "@/lib/markdown";

const markdownDirectory = join(process.cwd(), "content", "markdown");
const pagesPerPage = 2;

export default async function MorePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<main className="loading-page">Loading pages...</main>}>
      <MorePageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function MorePageContent({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { page: pageParam } = await searchParams;
  const requestedPage =
    typeof pageParam === "string" ? Number(pageParam) : Number.NaN;
  const pages = await getMarkdownParamsWithMetadata(markdownDirectory, "slug");
  const pageCount = Math.max(1, Math.ceil(pages.length / pagesPerPage));
  const currentPage = Number.isSafeInteger(requestedPage)
    ? Math.min(pageCount, Math.max(1, requestedPage))
    : 1;
  const pageEntries = pages.slice(
    (currentPage - 1) * pagesPerPage,
    currentPage * pagesPerPage,
  );
  const firstPage = (currentPage - 1) * pagesPerPage + 1;
  const lastPage = Math.min(currentPage * pagesPerPage, pages.length);

  return (
    <main className="activity-home">
      <div className="activity-heading">
        <p className="eyebrow">MORE TO EXPLORE</p>
        <h1>More pages.</h1>
        <p>Browse the public pages available on this site.</p>
      </div>
      <div className="activity-list-container">
        {pageEntries.length > 0 ? (
          <>
            <p className="activity-count">
              Showing {firstPage}-{lastPage} of {pages.length}{" "}
              {pages.length === 1 ? "page" : "pages"}
            </p>
            <ul className="activity-list">
              {pageEntries.map((page) => (
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
            {pageCount > 1 && (
              <nav className="activity-pagination" aria-label="More pages">
                {currentPage > 1 ? (
                  <Link href={`/more?page=${currentPage - 1}`}>Previous</Link>
                ) : (
                  <span aria-disabled="true">Previous</span>
                )}
                <span aria-current="page">
                  Page {currentPage} of {pageCount}
                </span>
                {currentPage < pageCount ? (
                  <Link href={`/more?page=${currentPage + 1}`}>Next</Link>
                ) : (
                  <span aria-disabled="true">Next</span>
                )}
              </nav>
            )}
          </>
        ) : (
          <p className="activity-empty">No pages are available yet.</p>
        )}
      </div>
    </main>
  );
}
