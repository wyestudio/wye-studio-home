import Image from "next/image";

/**
 * 테마 포스터.
 *
 * 포스터가 없으면 아무 그림도 깔지 않고 '이미지 준비중' 만 보여준다.
 * 예전에는 바-ㅇ탈출 아트웍을 기본값으로 깔았는데, 그러면 새 테마가
 * 남의 포스터를 달고 나가게 된다.
 *
 * 부모에 position(relative/absolute)과 크기가 있어야 한다(fill 사용).
 */
export function PosterImage({
  src,
  alt,
  sizes,
  priority = false,
}: {
  src: string | null;
  alt: string;
  sizes?: string;
  priority?: boolean;
}) {
  if (!src) {
    return (
      <span className="flex h-full w-full items-center justify-center text-xs text-muted">
        이미지 준비중
      </span>
    );
  }
  return <Image src={src} alt={alt} fill className="object-cover" sizes={sizes} priority={priority} />;
}

/** 행성 로고가 없는 테마가 쓰는 기본 그림 — 우리 로고. */
export const FALLBACK_LOGO = "/logo-white.png";
