import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { join } from "node:path";
import { Suspense } from "react";
import ActivityCard from "@/components/activity-card";
import { isDevAuthBypassEnabled } from "@/lib/auth";
import { getMarkdownParamsWithMetadata } from "@/lib/markdown-content";

const activityDirectory = join(process.cwd(), "content", "activity");
const activitiesPerPage = 5;

export default function Home({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  return (
    <Suspense
      fallback={<main className="loading-page">Loading activities...</main>}
    >
      <HomeContent searchParams={searchParams} />
    </Suspense>
  );
}

async function HomeContent({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const isAuthenticated =
    isDevAuthBypassEnabled || (await auth()).isAuthenticated;
  if (isAuthenticated) {
    const { page: pageParam } = await searchParams;
    const requestedPage =
      typeof pageParam === "string" ? Number(pageParam) : Number.NaN;
    const activities = await getMarkdownParamsWithMetadata(
      activityDirectory,
      "content",
    );
    const pageCount = Math.max(
      1,
      Math.ceil(activities.length / activitiesPerPage),
    );
    const currentPage = Number.isSafeInteger(requestedPage)
      ? Math.min(pageCount, Math.max(1, requestedPage))
      : 1;
    const pageActivities = activities.slice(
      (currentPage - 1) * activitiesPerPage,
      currentPage * activitiesPerPage,
    );
    const firstActivity = (currentPage - 1) * activitiesPerPage + 1;
    const lastActivity = Math.min(
      currentPage * activitiesPerPage,
      activities.length,
    );

    return (
      <main className="activity-home">
        <div className="activity-heading">
          <p className="eyebrow">YOUR MEMBERSHIP</p>
          <h1>Your activities.</h1>
          <p>Explore the latest activities included with your membership.</p>
        </div>
        <div className="activity-list-container">
          {pageActivities.length > 0 ? (
            <>
              <p className="activity-count">
                Showing {firstActivity}-{lastActivity} of {activities.length}{" "}
                {activities.length === 1 ? "activity" : "activities"}
              </p>
              <ul className="activity-list">
                {pageActivities.map((activity) => (
                  <li key={activity.content}>
                    <ActivityCard
                      slug={activity.content}
                      title={activity.title}
                      description={activity.description}
                      tags={activity.tags}
                    />
                  </li>
                ))}
              </ul>
              {pageCount > 1 && (
                <nav
                  className="activity-pagination"
                  aria-label="Activity pages"
                >
                  {currentPage > 1 ? (
                    <Link href={`/?page=${currentPage - 1}`}>Previous</Link>
                  ) : (
                    <span aria-disabled="true">Previous</span>
                  )}
                  <span aria-current="page">
                    Page {currentPage} of {pageCount}
                  </span>
                  {currentPage < pageCount ? (
                    <Link href={`/?page=${currentPage + 1}`}>Next</Link>
                  ) : (
                    <span aria-disabled="true">Next</span>
                  )}
                </nav>
              )}
            </>
          ) : (
            <p className="activity-empty">No activities are available yet.</p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="intro home-intro">
      <p className="eyebrow">WELCOME</p>
      <h1>
        Membership, <em>made simple.</em>
      </h1>
      <p>Find the membership that works for you.</p>
      <Link href="/subscribe/plan" className="home-cta">
        Explore membership options <span aria-hidden="true">→</span>
      </Link>
    </main>
  );
}
