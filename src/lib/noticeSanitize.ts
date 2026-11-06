import "server-only";
import sanitizeHtml from "sanitize-html";
import { NOTICE_COLORS, toNoticeHtml } from "@/lib/noticeBody";

/**
 * 공지 본문 HTML 을 화면에 내보내도 되는 것만 남긴다 — 저장할 때와 화면에 보낼 때 두 번 거른다.
 *
 * 어드민 입력이라도 `<script>` · `onclick` · `javascript:` 링크가 화면에 흘러가면 방문자 브라우저에서
 * 돈다. 편집기 버튼으로 만들 수 있는 태그(문단 · 소제목 · 목록 · 굵게 · 기울임 · 밑줄 · 취소선 · 색 · 링크 · 구분선 · 표)만 받는다.
 * ⚠️ 편집기에 버튼을 더하면 여기 허용 목록도 같이 늘린다 — 안 그러면 저장할 때 조용히 사라진다.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  // 표는 table · tbody · tr · th · td 만 — 편집기가 붙이는 colgroup · 너비(style) · 칸 합치기(colspan · rowspan)는 버린다
  allowedTags: ["p", "br", "h3", "ul", "ol", "li", "strong", "em", "u", "s", "hr", "a", "span", "table", "thead", "tbody", "tr", "th", "td"],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    span: [{ name: "data-color", multiple: false, values: NOTICE_COLORS.map((c) => c.key) }],
  },
  // 사이트 안 주소(/group)는 그대로, 밖은 http(s) 만. //evil.com 같은 주소는 막는다
  allowedSchemes: ["http", "https"],
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs): sanitizeHtml.Tag => {
      const href = attribs.href ?? "";
      // 사이트 안 링크는 같은 창, 밖으로 나가는 링크는 새 창
      return /^https?:\/\//.test(href)
        ? { tagName, attribs: { href, target: "_blank", rel: "noopener noreferrer" } }
        : { tagName, attribs: { href } };
    },
  },
};

/** 저장 · 화면용 — 옛 평문 본문이면 HTML 로 바꾼 뒤 거른다 */
export function sanitizeNoticeBody(body: string): string {
  return sanitizeHtml(toNoticeHtml(body), OPTIONS);
}

/** 글자만 — 빈 본문인지 볼 때 */
export function noticeBodyText(body: string): string {
  return sanitizeHtml(toNoticeHtml(body), { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, " ").trim();
}
