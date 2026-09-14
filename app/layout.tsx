import type { Metadata } from "next";
import Link from "next/link";
import SearchForm from "@/components/SearchForm";
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
          <SearchForm />
        </header>
        <main className="site-main">{children}</main>
        <footer className="site-footer" data-testid="disclaimer">
          KnowDB is a prototype. Descriptions, links and other information
          shown here are AI generated and may contain mistakes.
        </footer>
      </body>
    </html>
  );
}
