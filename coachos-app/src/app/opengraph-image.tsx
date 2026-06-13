import { ImageResponse } from "next/og";

export const alt = "CoachOS institute operations dashboard";
export const contentType = "image/png";
export const size = {
  height: 630,
  width: 1200,
};

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background:
            "linear-gradient(135deg, #f7f8ff 0%, #eef0ff 48%, #fff7ed 100%)",
          color: "#111827",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          padding: 72,
          width: "100%",
        }}
      >
        <div
          style={{
            background: "rgba(255,255,255,0.86)",
            border: "1px solid rgba(79,70,229,0.18)",
            borderRadius: 28,
            boxShadow: "0 32px 90px rgba(79,70,229,0.18)",
            display: "flex",
            flexDirection: "column",
            gap: 30,
            padding: 56,
            width: "100%",
          }}
        >
          <div style={{ alignItems: "center", display: "flex", gap: 18 }}>
            <div
              style={{
                alignItems: "center",
                background: "#1e1b4b",
                borderRadius: 18,
                color: "#ffffff",
                display: "flex",
                height: 72,
                justifyContent: "center",
                width: 72,
              }}
            >
              <svg
                width="44"
                height="38"
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
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 42, fontWeight: 800 }}>CoachOS</div>
              <div style={{ color: "#6b7280", fontSize: 24 }}>
                Institute operations dashboard
              </div>
            </div>
          </div>

          <div
            style={{
              fontSize: 62,
              fontWeight: 800,
              letterSpacing: -1,
              lineHeight: 1.05,
              maxWidth: 930,
            }}
          >
            Manage branches, students, batches, attendance, fees, and staff.
          </div>

          <div
            style={{
              color: "#4b5563",
              display: "flex",
              fontSize: 25,
              gap: 18,
            }}
          >
            <span>Multi-branch ready</span>
            <span>•</span>
            <span>Role-aware access</span>
            <span>•</span>
            <span>Demo-ready workflows</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
