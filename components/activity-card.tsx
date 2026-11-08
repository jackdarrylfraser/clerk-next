import Link from "next/link";
import { getTagSlug } from "@/lib/tags";

type ActivityCardProps = {
  slug: string;
  title: string;
  description: string;
  tags: string[];
  isCurrent?: boolean;
  detailBasePath?: string;
  tagBasePath?: string;
};

export default function ActivityCard({
  slug,
  title,
  description,
  tags,
  isCurrent = false,
  detailBasePath = "/activity",
  tagBasePath = "/activity/tag",
}: ActivityCardProps) {
  const copy = (
    <span className="activity-card-copy">
      <span className="activity-card-title">{title}</span>
      <span className="activity-card-description">{description}</span>
    </span>
  );

  return (
    <div className="activity-card">
      {isCurrent ? (
        <div className="activity-card-link">{copy}</div>
      ) : (
        <Link
          className="activity-card-link"
          href={`${detailBasePath}/${encodeURIComponent(slug)}`}
        >
          {copy}
          <span aria-hidden="true">→</span>
        </Link>
      )}
      <span className="activity-card-tags" aria-label="Tags">
        {tags.map((tag) => (
          <Link
            className="activity-card-tag"
            href={`${tagBasePath}/${getTagSlug(tag)}`}
            key={tag}
          >
            {tag}
          </Link>
        ))}
      </span>
    </div>
  );
}
