import { ImageResponse } from "next/og";

export const contentType = "image/png";
export const size = {
  height: 32,
  width: 32,
};

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "linear-gradient(145deg, #5b50e6, #3b32b5)",
          borderRadius: 8,
          color: "#ffffff",
          display: "flex",
          fontSize: 20,
          fontWeight: 800,
          height: "100%",
          justifyContent: "center",
          letterSpacing: -0.5,
          width: "100%",
        }}
      >
        C
      </div>
    ),
    size,
  );
}
