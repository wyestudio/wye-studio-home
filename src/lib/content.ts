import { createClient } from "@/lib/supabase/server";

/**
 * 공지·FAQ 조회.
 *
 * 예전에는 두 컴포넌트에 배열로 하드코딩돼 있어 문구 하나 고치려면 배포가
 * 필요했다. 매주 운영에서 가장 자주 바뀌는 부분이라 DB 로 옮겼다.
 *
 * 공개 여부는 RLS 가 정한다 — anon 은 published_at 이 지난 공지와
 * is_visible 인 FAQ 만 읽을 수 있다. 여기서 다시 거르지 않는다.
 */

export type Notice = {
  id: string;
  title: string;
  body: string;
  is_pinned: boolean;
  published_at: string | null;
  sort_order: number;
};

export type Faq = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  is_visible: boolean;
  sort_order: number;
};

export async function getPublishedNotices(): Promise<Notice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notices")
    .select("id, title, body, is_pinned, published_at, sort_order")
    .order("is_pinned", { ascending: false })
    .order("published_at", { ascending: false });

  if (error) {
    // 공지를 못 읽는다고 페이지 전체를 죽이지 않는다. 빈 목록으로 떨어진다.
    console.error("[content] 공지 조회 실패", error);
    return [];
  }
  return (data ?? []) as Notice[];
}

export async function getVisibleFaqs(): Promise<Faq[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("faqs")
    .select("id, question, answer, category, is_visible, sort_order")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[content] FAQ 조회 실패", error);
    return [];
  }
  return (data ?? []) as Faq[];
}
