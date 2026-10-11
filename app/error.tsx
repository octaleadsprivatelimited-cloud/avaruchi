"use client";
export default function StoreError({ retry }: { retry: () => void }) {
  const recovery = (
    <section className="empty-state wrap" role="alert">
      <span className="eyebrow">AVARUCHI</span>
      <h1>The store hit a temporary problem.</h1>
      <p>
        Retry this page. If you were placing an order or paying, review your
        orders before submitting again.
      </p>
      <button className="button" onClick={retry}>
        Retry page
      </button>
      <a className="button outline" href="/account?tab=orders">
        Review orders
      </a>
      <a className="link-button" href="/shop">
        Shop pickles
      </a>
    </section>
  );
  return recovery;
}
