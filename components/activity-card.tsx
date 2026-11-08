import Link from "next/link";

type ActivityCardProps = {
  slug: string;
  title: string;
};

export default function ActivityCard({ slug, title }: ActivityCardProps) {
  return (
    <Link
      className="activity-card"
      href={`/activity/${encodeURIComponent(slug)}`}
    >
      <span>{title}</span>
      <span aria-hidden="true">→</span>
    </Link>
  );
}
