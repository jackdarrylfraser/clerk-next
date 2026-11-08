import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { join } from "node:path";
import ActivityCard from "@/components/activity-card";
import { isDevAuthBypassEnabled } from "@/lib/auth";
import { getMarkdownMetadata, getMarkdownParams } from "@/lib/markdown";
import { getTagSlug } from "@/lib/tags";

const activityDirectory = join(process.cwd(), "content", "activity");
const tagSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function getActivities() {
  const activityParams = await getMarkdownParams(activityDirectory, "content");
  return Promise.all(
    activityParams.map(async ({ content }) => ({
      content,
      ...(await getMarkdownMetadata(activityDirectory, content)),
    })),
  );
}

export async function generateStaticParams() {
  const activities = await getActivities();
  const tagSlugs = new Set(
    activities.flatMap((activity) =>
      activity.tags?.map((tag) => getTagSlug(tag)) ?? [],
    ),
  );

  return [...tagSlugs].sort().map((slug) => ({ slug }));
}

export default function TagPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense fallback={<main className="loading-page">Loading activities...</main>}>
      <TagPageContent params={params} />
    </Suspense>
  );
}

async function TagPageContent({
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

  const activities = await getActivities();
  const taggedActivities = activities.filter((activity) =>
    activity.tags?.some((tag) => getTagSlug(tag) === slug),
  );
  const tag = taggedActivities
    .flatMap((activity) => activity.tags ?? [])
    .find((activityTag) => getTagSlug(activityTag) === slug);

  if (!tag || taggedActivities.length === 0) {
    notFound();
  }

  return (
    <main className="activity-home">
      <div className="activity-heading">
        <p className="eyebrow">ACTIVITY TAG</p>
        <h1>{tag}</h1>
        <p>Activities with this tag.</p>
      </div>
      <div className="activity-list-container">
        <p className="activity-count">
          {taggedActivities.length}{" "}
          {taggedActivities.length === 1 ? "activity" : "activities"}
        </p>
        <ul className="activity-list">
          {taggedActivities.map((activity) => (
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
      </div>
    </main>
  );
}
