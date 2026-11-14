import Link from "next/link";

export default async function SiteFooter() {
  const year = await getCurrentYear();

  return (
    <footer className="site-footer">
      <span>© {year} MEMBERSHIP</span>
      <nav className="legal-footer-links" aria-label="Site information">
        <Link href="/terms-of-service">Terms of Service</Link>
        <Link href="/privacy-policy">Privacy Policy</Link>
        <Link href="/contact">Contact Us</Link>
      </nav>
      <span>YOUR NEXT CHAPTER STARTS HERE ↗</span>
    </footer>
  );
}

async function getCurrentYear() {
  "use cache";

  return new Date().getFullYear();
}
