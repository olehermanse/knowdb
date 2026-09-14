import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "KnowDB",
  description: "Explore your infrastructure, Wikipedia-style.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link href="/">KnowDB</Link>
        </header>
        <main className="site-main">{children}</main>
      </body>
    </html>
  );
}
