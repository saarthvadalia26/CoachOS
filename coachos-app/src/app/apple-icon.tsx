import { ImageResponse } from "next/og";

export const contentType = "image/png";
export const size = {
  height: 180,
  width: 180,
};

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "linear-gradient(145deg, #5b50e6, #3b32b5)",
          borderRadius: 38,
          color: "#ffffff",
          display: "flex",
          fontSize: 108,
          fontWeight: 800,
          height: "100%",
          justifyContent: "center",
          letterSpacing: -2,
          width: "100%",
        }}
      >
        C
      </div>
    ),
    size,
  );
}
