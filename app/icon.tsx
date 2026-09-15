import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0e7c72",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            color: "#f7f6f3",
            fontSize: 280,
            fontWeight: 700,
            letterSpacing: -12,
            lineHeight: 1,
          }}
        >
          S
        </div>
      </div>
    ),
    { ...size }
  );
}
