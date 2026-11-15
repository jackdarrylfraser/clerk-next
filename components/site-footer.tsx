import Link from "next/link";
import { io } from "next/cache";
import { Suspense } from "react";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>
        © <Suspense fallback={null}><CurrentYear /></Suspense> MEMBERSHIP
      </span>
      <nav className="legal-footer-links" aria-label="Site information">
        <Link href="/terms-of-service">Terms of Service</Link>
        <Link href="/privacy-policy">Privacy Policy</Link>
        <Link href="/contact">Contact Us</Link>
      </nav>
      <span>YOUR NEXT CHAPTER STARTS HERE ↗</span>
    </footer>
  );
}

async function CurrentYear() {
  await io();
  return new Date().getFullYear();
}
