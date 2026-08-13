"use client";

import { useEffect, useRef, useState } from "react";

export function Select({
  id,
  value,
  onChange,
  options,
  placeholder,
  invalid,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  invalid?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const selectedLabel = options.find((opt) => opt.value === value)?.label || placeholder;

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        id={id}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setIsOpen(false);
        }}
        className={`w-full rounded-lg border bg-surface px-4 py-2.5 text-sm text-foreground outline-none transition-shadow flex items-center justify-between ${
          invalid
            ? "border-danger bg-danger-soft text-danger"
            : isOpen
              ? "border-brand focus:border-brand focus:shadow-[0_0_0_3px_var(--brand-soft)]"
              : "border-border focus:border-brand focus:shadow-[0_0_0_3px_var(--brand-soft)]"
        }`}
      >
        <span className={selectedLabel === placeholder ? "text-muted" : ""}>
          {selectedLabel}
        </span>
        <span className="shrink-0">▾</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 rounded-lg border border-border bg-surface shadow-lg z-10 overflow-hidden">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                value === option.value
                  ? "bg-brand text-brand-foreground font-medium"
                  : "text-foreground hover:bg-brand-soft"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
