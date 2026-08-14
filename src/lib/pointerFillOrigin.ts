export function handlePointerFillOrigin(e: React.PointerEvent<HTMLElement>) {
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  el.style.setProperty("--origin-x", `${e.clientX - rect.left}px`);
  el.style.setProperty("--origin-y", `${e.clientY - rect.top}px`);
  // 버튼의 대각선 길이 × 2를 --fill-size로 계산해 어떤 지점을 눌러도 원이 버튼 전체를 덮도록 함
  const diagonal = Math.hypot(rect.width, rect.height);
  el.style.setProperty("--fill-size", `${diagonal * 2}px`);
}
