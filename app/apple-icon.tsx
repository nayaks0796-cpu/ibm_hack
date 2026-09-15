import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          borderRadius: 36,
        }}
      >
        <div
          style={{
            display: "flex",
            color: "#f7f6f3",
            fontSize: 108,
            fontWeight: 700,
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
