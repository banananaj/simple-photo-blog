import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "gidong", template: "%s — gidong" },
  description: "Photographs by gidong, shown in no particular order.",
  metadataBase: new URL("https://gidong.pics"),
};

export const viewport: Viewport = {
  themeColor: "#fbfaf8",
  colorScheme: "light",
};

// Adds `.js` before first paint so the stream can wait for its shuffle without
// hiding anything from a reader whose script never runs (Hallmark gate 62).
const jsFlag = "document.documentElement.classList.add('js')";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="anonymous" />
        <link href="https://api.fontshare.com/v2/css?f[]=sentient@300,400&display=swap" rel="stylesheet" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- app router root layout, every page gets it */}
        <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@300;400&display=swap" rel="stylesheet" />
        <script dangerouslySetInnerHTML={{ __html: jsFlag }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
