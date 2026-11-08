import Link from "next/link";

export default function Home() {
  return (
    <main className="intro home-intro">
      <p className="eyebrow">WELCOME</p>
      <h1>
        Membership, <em>made simple.</em>
      </h1>
      <p>Find the membership that works for you.</p>
      <Link href="/subscribe" className="home-cta">
        Explore membership options <span aria-hidden="true">→</span>
      </Link>
    </main>
  );
}
