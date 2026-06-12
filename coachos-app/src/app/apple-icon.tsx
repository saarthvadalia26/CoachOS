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
          background: "linear-gradient(145deg, #2d2a8a, #3b32b5)",
          borderRadius: 38,
          display: "flex",
          height: "100%",
          justifyContent: "center",
          position: "relative",
          width: "100%",
        }}
      >
        {/* Amber crescent accent — top right */}
        <div
          style={{
            background: "linear-gradient(135deg, #e8a030, #f0c060)",
            borderRadius: "50%",
            display: "flex",
            height: 100,
            position: "absolute",
            right: -16,
            top: -16,
            width: 100,
          }}
        />
        {/* Inner dark cutout to form crescent */}
        <div
          style={{
            background: "#302d92",
            borderRadius: "50%",
            display: "flex",
            height: 74,
            position: "absolute",
            right: -4,
            top: -6,
            width: 74,
          }}
        />
        {/* White stylized "C" — open arc */}
        <svg
          width="100"
          height="100"
          viewBox="0 0 100 100"
          fill="none"
          style={{ position: "relative", zIndex: 1, marginTop: 6 }}
        >
          <path
            d="M72 26C65 18 57 14 48 14C28.2 14 12 30.2 12 50C12 69.8 28.2 86 48 86C57 86 65 82 72 74"
            stroke="white"
            strokeWidth="14"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </div>
    ),
    size,
  );
}
