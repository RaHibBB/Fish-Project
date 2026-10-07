import { ImageResponse } from "next/og";

/** PNG app icon (white fish on farm green) for the PWA manifest and apple-touch-icon. */
export function iconImage(size: number) {
  const fish = size * 0.62;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f8a6a",
        }}
      >
        <svg width={fish} height={fish} viewBox="8 8 48 48">
          <path
            d="M10 32c7-10 17-14 27-11 4 1 8 4 11 7l7-6v20l-7-6c-3 3-7 6-11 7-10 3-20-1-27-11z"
            fill="#fff"
          />
          <circle cx="22" cy="29" r="2.6" fill="#0f8a6a" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
