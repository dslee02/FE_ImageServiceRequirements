import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "암호화 이미지 렌더링",
  description:
    "AES-GCM으로 암호화된 AVIF/WebP 이미지를 AES-GCM-256 복호화하여 Canvas에 렌더링하는 데모",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
