"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          background: "#f6f1e8",
          color: "#1b1b19",
          fontFamily: "Georgia, serif",
          textAlign: "center",
          padding: "1.5rem",
        }}
      >
        <p style={{ fontSize: "1.75rem", margin: 0 }}>Sampark hit a snag.</p>
        <p style={{ margin: 0, color: "#6b655c" }}>Reload this screen to continue.</p>
        <button
          type="button"
          onClick={reset}
          style={{
            minHeight: "2.75rem",
            padding: "0 1.25rem",
            borderRadius: "999px",
            border: "none",
            background: "#f2b705",
            color: "#1b1b19",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
