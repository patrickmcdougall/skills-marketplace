"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="pp-notfound">
      <h1>Something went wrong.</h1>
      <p>The registry is temporarily unavailable. Try refreshing.</p>
      <button className="lp-btn accent" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
