"use client";

// Last resort when the root layout itself fails: it replaces <html>, so no app CSS or
// fonts are guaranteed. Plain inline styles in the brand colours.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#0a0b0a",
          color: "#efece2",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: 16,
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 36, color: "#ffb020", margin: 0 }}>ERR</p>
          <h1 style={{ fontSize: 24, margin: "16px 0 8px" }}>Scrubcast is having trouble</h1>
          <p style={{ color: "#9aa093", margin: "0 0 24px" }}>Something broke while loading. Please try again.</p>
          <button
            type="button"
            onClick={reset}
            style={{
              minHeight: 44,
              padding: "0 20px",
              borderRadius: 8,
              border: 0,
              background: "#ffb020",
              color: "#1a1200",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
