import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { join } from "node:path";
import { Suspense } from "react";
import ActivityCard from "@/components/activity-card";
import { isDevAuthBypassEnabled } from "@/lib/auth";
import { getMarkdownParamsWithMetadata } from "@/lib/markdown-content";

const guestDirectory = join(process.cwd(), "content", "guest");
const pagesPerPage = 2;

export default function GuestPagesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  return (
    <Suspense
      fallback={      <main className="loading-page">Loading guest pages...</main>}
    >
      <GuestPagesContent searchParams={searchParams} />
    </Suspense>
  );
}

async function GuestPagesContent({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  if (!isDevAuthBypassEnabled) {
    await auth.protect({ feature: "user:site_access" });
  }

  const { page: pageParam } = await searchParams;
  const requestedPage =
    typeof pageParam === "string" ? Number(pageParam) : Number.NaN;
  const pages = await getMarkdownParamsWithMetadata(guestDirectory, "slug");
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
        <p className="eyebrow">GUEST CONTENT</p>
        <h1>Guest content.</h1>
        <p>Browse the guest content available with your membership.</p>
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
                    detailBasePath="/guest"
                    tagBasePath="/guest/tag"
                  />
                </li>
              ))}
            </ul>
            {pageCount > 1 && (
              <nav className="activity-pagination" aria-label="Guest pages">
                {currentPage > 1 ? (
                  <Link href={`/guest?page=${currentPage - 1}`}>
                    Previous
                  </Link>
                ) : (
                  <span aria-disabled="true">Previous</span>
                )}
                <span aria-current="page">
                  Page {currentPage} of {pageCount}
                </span>
                {currentPage < pageCount ? (
                  <Link href={`/guest?page=${currentPage + 1}`}>Next</Link>
                ) : (
                  <span aria-disabled="true">Next</span>
                )}
              </nav>
            )}
          </>
        ) : (
          <p className="activity-empty">No guest pages are available yet.</p>
        )}
      </div>
    </main>
  );
}
