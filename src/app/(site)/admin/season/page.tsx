import { createAdminClient } from "@/lib/supabase/admin";
import { AdminNav } from "@/components/admin/AdminNav";
import { isSiteSkin } from "@/lib/season";
import { SeasonSkinToggle } from "./SeasonSkinToggle";

export const dynamic = "force-dynamic";

export default async function AdminSeasonPage() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("site_settings")
    .select("value, updated_at")
    .eq("key", "site.season")
    .maybeSingle();

  const raw = (data?.value as { skin?: unknown } | null)?.skin;
  const current = isSiteSkin(raw) ? raw : null;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <AdminNav current="/season" />

        <header className="mb-6">
          <h1 className="text-h2 font-semibold">시즌 스킨</h1>
          <p className="mt-1 text-body-sm text-muted">
            할로윈처럼 기간 동안만 고객 화면에 씌우는 장식입니다. 로고 모자 · 배경 장식 ·
            포스터 장식 · 사이트 색이 함께 바뀝니다.{" "}
            <strong>켜면 30초 안에 고객 화면 전체에 적용됩니다.</strong> 끝나는 날짜는 없으니
            기간이 지나면 직접 꺼 주세요. 어드민 화면에는 씌우지 않습니다.
          </p>
        </header>

        {error ? (
          <div className="text-red-400">설정을 불러올 수 없습니다: {error.message}</div>
        ) : (
          <SeasonSkinToggle
            current={current}
            updatedAt={data?.updated_at ?? null}
          />
        )}
      </div>
    </div>
  );
}
