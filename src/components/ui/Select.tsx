"use client";

import { useEffect, useRef, useState } from "react";

export function Select({
  id,
  value,
  onChange,
  options,
  placeholder,
  invalid,
  variant = "surface",
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  invalid?: boolean;
  /** glass = 반투명 카드 위에 올리는 신청 폼용. surface = 기존 화면용. */
  variant?: "surface" | "glass";
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

  function handleArrowKey(direction: "up" | "down") {
    const currentIndex = options.findIndex((opt) => opt.value === value);
    let nextIndex = currentIndex;

    if (direction === "down" && currentIndex < options.length - 1) {
      nextIndex = currentIndex + 1;
    } else if (direction === "up" && currentIndex > 0) {
      nextIndex = currentIndex - 1;
    }

    if (nextIndex !== currentIndex) {
      onChange(options[nextIndex].value);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        id={id}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setIsOpen(false);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            handleArrowKey("down");
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            handleArrowKey("up");
          }
        }}
        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm text-foreground outline-none transition-shadow ${
          variant === "glass" ? "bg-white/5" : "bg-surface px-4"
        } ${
          invalid
            ? "border-danger bg-danger-soft text-danger"
            : isOpen
              ? "border-brand focus:border-brand focus:shadow-[0_0_0_3px_var(--brand-soft)]"
              : variant === "glass"
                ? "border-white/20 focus:border-white/50"
                : "border-border focus:border-brand focus:shadow-[0_0_0_3px_var(--brand-soft)]"
        }`}
      >
        <span className={selectedLabel === placeholder ? "text-muted" : ""}>
          {selectedLabel}
        </span>
        <span className="shrink-0">▾</span>
      </button>

      {isOpen && (
        /* 5개까지 보이고 나머지는 스크롤. 출생연도처럼 항목이 70개인 칸이 있다. */
        <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-[13.75rem] overflow-y-auto rounded-lg border border-border bg-surface shadow-lg">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`block w-full px-4 py-2.5 text-left text-sm transition-colors ${
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
