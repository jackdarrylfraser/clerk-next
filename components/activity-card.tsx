import Link from "next/link";
import { getTagSlug } from "@/lib/tags";

type ActivityCardProps = {
  slug: string;
  title: string;
  description?: string;
  tags?: string[];
};

export default function ActivityCard({
  slug,
  title,
  description,
  tags,
}: ActivityCardProps) {
  return (
    <div className="activity-card">
      <Link
        className="activity-card-link"
        href={`/activity/${encodeURIComponent(slug)}`}
      >
        <span className="activity-card-copy">
          <span>{title}</span>
          {description && (
            <span className="activity-card-description">{description}</span>
          )}
        </span>
        <span aria-hidden="true">→</span>
      </Link>
      {tags && tags.length > 0 && (
        <span className="activity-card-tags" aria-label="Tags">
          {tags.map((tag) => (
            <Link
              className="activity-card-tag"
              href={`/tag/${getTagSlug(tag)}`}
              key={tag}
            >
              {tag}
            </Link>
          ))}
        </span>
      )}
    </div>
  );
}
