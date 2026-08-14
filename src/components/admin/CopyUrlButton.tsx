"use client";

import { useState } from "react";

interface CopyUrlButtonProps {
  url: string;
}

export function CopyUrlButton({ url }: CopyUrlButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // no-op
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded-md border border-border px-2 py-1 text-xs text-muted hover:text-foreground transition-colors"
    >
      {copied ? "복사됨" : "링크 복사"}
    </button>
  );
}
