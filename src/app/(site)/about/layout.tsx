import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  openGraph: { title: "우주이스케이프 | About" },
  twitter: { title: "우주이스케이프 | About" },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
