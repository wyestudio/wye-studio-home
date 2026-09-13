import { SectionHeading } from "@/components/ui/SectionHeading";
import { ThemeCard } from "@/components/contents/ThemeCard";
import { themeTitleFontClass, type ThemeWithTiers } from "@/types/catalog";

export type ThemeCardData = ThemeWithTiers & {
  /** 앞으로 남은 회차 수 */
  upcomingCount: number;
  /** 가장 가까운 회차 시작 시각 (없으면 null) */
  nextStartAt: string | null;
};

/**
 * 테마 목록 — 포스터 카드.
 *
 * 예전에는 행성 로고가 떠 있다가 hover 하면 카드로 펼쳐졌는데, 목록에서는
 * 포스터만 보이는 게 낫다는 결정이 나서 걷어냈다. 행성 로고 자체는 홈의
 * 'Planets to Escape' 와 어드민 설정에 그대로 남아 있다 — 목록에 다시
 * 쓰고 싶어지면 `themes.logo_image_path` 를 그대로 쓰면 된다.
 *
 * 카드 한 장은 ThemeCard(클라이언트)다 — 잠긴 카드를 누르면 자물쇠가 흔들려야
 * 해서 상태가 필요하다.
 */
export function ThemeShowcase({ themes }: { themes: ThemeCardData[] }) {
  return (
    <section className="mx-auto max-w-5xl px-5 py-14">
      <SectionHeading eyebrow="CONTENTS" />

      {themes.length === 0 ? (
        <div className="mt-10 rounded-xl border border-white/15 bg-white/5 p-10 text-center">
          <p className="font-semibold">현재 공개된 컨텐츠가 없습니다.</p>
          <p className="mt-2 text-sm text-muted">새 컨텐츠가 준비되면 안내드릴게요.</p>
        </div>
      ) : (
        /*
          격자 대신 flex — 테마가 열 수보다 적을 때 왼쪽에 붙지 않고 가운데로
          모인다. 폭은 gap(1.25rem)을 뺀 뒤 열 수로 나눠 격자와 똑같이 맞춘다.
        */
        <div className="mt-10 flex flex-wrap justify-center gap-5">
          {themes.map((theme) => (
            <ThemeCard
              key={theme.id}
              name={theme.name}
              slug={theme.slug}
              posterPath={theme.hero_image_path}
              difficulty={theme.difficulty}
              durationMinutes={theme.duration_minutes}
              titleFontClass={themeTitleFontClass(theme.title_font)}
              locked={theme.is_locked}
            />
          ))}
        </div>
      )}
    </section>
  );
}
