import Link from "next/link";
export default function NotFound() {
  return (
    <section className="empty-state wrap">
      <span className="eyebrow">404 / A MISSING SPOONFUL</span>
      <h1>This page has left the table.</h1>
      <p>Explore our collection and find your next favourite jar.</p>
      <Link className="button" href="/shop">
        Shop pickles
      </Link>
    </section>
  );
}
