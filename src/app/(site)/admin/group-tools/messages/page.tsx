import Link from "next/link";
import { AdminNotice, AdminPage } from "@/components/admin/ui";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTimeFull } from "@/lib/format";
import { GroupMessageList } from "./GroupMessageList";

export const dynamic = "force-dynamic";

/**
 * 단체 도구 › 안내 문자 템플릿(관리자 개편 7단계).
 *
 * 단체 상세의 「설문 · 문자」 탭에서 복사해 쓰는 문구의 **원본**이다. 여기서 고치면 그 탭의 문구가 바뀐다.
 * ⚠️ 보내는 문자가 아니다 — 시스템이 발송하지 않는다. 일반 문자(신청 · 입금 안내 등)는 설정 › 문자 템플릿에 있다.
 */
export default async function GroupMessagesPage() {
  const { data, error } = await createAdminClient()
    .from("sms_templates")
    .select("key, label, body, placeholders, updated_at")
    .like("key", "group_%")
    .order("key", { ascending: true });

  // 단계 순서대로 보여준다(키 순서가 아니라 쓰는 순서).
  const ORDER = ["group_quote", "group_nudge", "group_deposit", "group_d7_transfer", "group_d7_card", "group_d7_corp_card", "group_d1", "group_report"];
  const rows = ((data ?? []) as { key: string; label: string; body: string; placeholders: string[] | null; updated_at: string }[])
    .slice()
    .sort((a, b) => (ORDER.indexOf(a.key) + 100) % 100 - ((ORDER.indexOf(b.key) + 100) % 100) || a.key.localeCompare(b.key));

  return (
    <AdminPage
      title="안내 문자 템플릿"
      description={
        <>
          단체 상세의 「설문 · 문자」 탭에서 복사해 쓰는 문구의 원본입니다. 시스템이 문자를 보내지는 않습니다. 일반 문자는{" "}
          <Link href="/sms-templates" className="text-glow underline">
            설정 › 문자 템플릿
          </Link>
          에 있어요.
        </>
      }
    >
      {error ? (
        <p role="alert" className="text-body-sm text-danger">
          문구를 불러오지 못했습니다: {error.message}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <AdminNotice title="고치기 전에">
            <ul className="list-disc pl-5">
              <li>
                <code>{"{{이름}}"}</code> 자리는 단체마다 실제 값으로 바뀝니다. 목록에 없는 이름을 쓰면 저장되지 않습니다.
              </li>
              <li>
                계좌는 문구에 직접 적지 말고 <code>{"{{bank_account}}"}</code> 를 쓰세요.
              </li>
              <li>
                견적 안내의 「• 방탈출: … = …」 줄과 「예약 확정을 위해 총 이용 금액의 30%인 …」 문장은 단체 상황(별도 상담가 · 학생 단체 · 7일 이내 전액 입금)에
                따라 자동으로 바뀝니다. 이 두 문장의 글자를 고치면 자동 바꿈이 동작하지 않습니다.
              </li>
            </ul>
          </AdminNotice>
          <GroupMessageList
            templates={rows.map((t) => ({
              key: t.key,
              label: t.label,
              body: t.body,
              placeholders: t.placeholders ?? [],
              updatedAt: formatDateTimeFull(t.updated_at),
            }))}
          />
        </div>
      )}
    </AdminPage>
  );
}
