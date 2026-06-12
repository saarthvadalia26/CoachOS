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
          background: "#1e1b4b",
          borderRadius: 7,
          display: "flex",
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <svg
          width="20"
          height="18"
          viewBox="0 0 28 24"
          fill="none"
        >
          <path
            d="M4 4L12 12L4 20"
            stroke="white"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M15 4L23 12L15 20"
            stroke="white"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    size,
  );
}
