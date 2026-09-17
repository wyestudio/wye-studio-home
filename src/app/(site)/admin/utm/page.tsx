import { createAdminClient } from "@/lib/supabase/admin";
import { AdminNav } from "@/components/admin/AdminNav";
import type { UtmLink } from "@/lib/utmLinks";
import { UtmLinkEditor } from "./UtmLinkEditor";

export const dynamic = "force-dynamic";

export default async function AdminUtmPage() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("utm_links")
    .select("*")
    .order("status", { ascending: true })
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl">
        <AdminNav current="/utm" />

        <header className="mb-6">
          <h1 className="text-2xl font-bold">유입경로 링크</h1>
          <p className="mt-1 text-sm text-muted">
            채널마다 뿌리는 링크를 여기서 만들고 관리합니다. 빈칸을 채우면 주소가 자동으로
            조립되고, 매체는 정해진 값 중에서만 고를 수 있어 오타로 통계가 갈라지는 일이
            없습니다. 규칙은 컨플루언스{" "}
            <strong className="text-foreground">WYE-89</strong> 문서를 따릅니다.
          </p>
          <p className="mt-2 text-sm text-muted">
            · <strong className="text-foreground">코드 고정</strong>으로 표시된 링크는{" "}
            <code className="font-mono text-xs">next.config.ts</code> 에 박혀 있어{" "}
            <strong className="text-foreground">여기서 값을 고쳐도 실제 동작은 바뀌지 않습니다</strong>
            (이미 외부에 뿌린 주소라 일부러 그대로 뒀습니다). 메모와 사용 여부만 바꿀 수 있습니다.
            <br />· 끝난 이벤트 링크는 <strong className="text-foreground">지우지 말고 &lsquo;중단&rsquo;</strong>
            으로 내려주세요. 지우면 그 캠페인으로 들어온 과거 유입이 무슨 뜻이었는지 알 수 없게 됩니다.
          </p>
        </header>

        {error ? (
          <div className="text-red-400">유입링크를 불러올 수 없습니다: {error.message}</div>
        ) : (
          <UtmLinkEditor links={(data ?? []) as UtmLink[]} />
        )}
      </div>
    </div>
  );
}
