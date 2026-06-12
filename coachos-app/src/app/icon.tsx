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
          background: "linear-gradient(145deg, #2d2a8a, #3b32b5)",
          borderRadius: 7,
          display: "flex",
          height: "100%",
          justifyContent: "center",
          position: "relative",
          width: "100%",
        }}
      >
        {/* Abstract arc — top-right amber accent */}
        <div
          style={{
            background: "linear-gradient(135deg, #e8a030, #f0c060)",
            borderRadius: "50%",
            display: "flex",
            height: 18,
            position: "absolute",
            right: -3,
            top: -3,
            width: 18,
          }}
        />
        {/* Inner dark cutout to form crescent */}
        <div
          style={{
            background: "#2f2c90",
            borderRadius: "50%",
            display: "flex",
            height: 13,
            position: "absolute",
            right: 0,
            top: -1,
            width: 13,
          }}
        />
        {/* White stylized "C" — open arc */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
          style={{ position: "relative", zIndex: 1, marginTop: 1 }}
        >
          <path
            d="M13.5 4.5C12.2 3.2 10.7 2.5 9 2.5C5.4 2.5 2.5 5.4 2.5 9C2.5 12.6 5.4 15.5 9 15.5C10.7 15.5 12.2 14.8 13.5 13.5"
            stroke="white"
            strokeWidth="2.8"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </div>
    ),
    size,
  );
}
