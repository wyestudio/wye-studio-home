import { Fragment } from "react";
import Link from "next/link";

/**
 * 운영자가 어드민에서 입력한 평문을 화면용으로 렌더한다.
 *
 * 줄바꿈을 살리고, URL 을 링크로, **별표 두 개로 감싼 부분**을 굵게,
 * `[문구](주소)` 를 문구가 보이는 링크로 만든다.
 * 예전에는 이 내용이 코드 안에 JSX 로 들어 있어 링크를 넣으려면 개발자가 필요했다.
 *
 * ⚠️ HTML 을 그대로 넣지 않는다(dangerouslySetInnerHTML 미사용).
 *    어드민 입력이라도 화면에 raw HTML 을 흘릴 이유가 없다.
 */
// ⚠️ split 용(/g)과 판별용을 분리한다. /g 정규식의 .test() 는 lastIndex 를
//    들고 다녀서 같은 문자열에도 true/false 가 번갈아 나온다.
const URL_SPLIT = /(https?:\/\/[^\s<>()]+)/g;
const IS_URL = /^https?:\/\//;
/** **굵게** — 문구에서 한 부분만 강조하고 싶을 때. 여는/닫는 별표가 짝이 맞아야 한다. */
const BOLD_SPLIT = /(\*\*[^*]+\*\*)/g;
const IS_BOLD = /^\*\*[^*]+\*\*$/;
/**
 * `[단체 예약 안내](/group)` — 주소가 아니라 **문구가 보이는** 링크.
 *
 * 왜 필요한가
 *   URL 자동 링크는 주소가 그대로 글자로 나와서, 문장 가운데 넣으면 읽기 어렵다.
 *   "자세한 내용은 www.wouldyouescape.com/group 에서" 처럼 된다.
 *
 * ⚠️ 받는 주소는 `http(s)://` 또는 사이트 안의 `/` 로 시작하는 것뿐이다.
 *    `javascript:` 같은 것을 어드민 입력으로 심지 못하게 모양 자체를 막는다.
 */
const LINK_SPLIT = /(\[[^\]\n]+\]\((?:https?:\/\/|\/)[^\s)]*\))/g;
const LINK_PARTS = /^\[([^\]\n]+)\]\(((?:https?:\/\/|\/)[^\s)]*)\)$/;

const LINK_CLASS = "underline underline-offset-2 hover:text-foreground";

/** 굵게만 처리한 조각들. 링크 안쪽 문구에도 그대로 쓴다. */
function withBold(text: string) {
  return text.split(BOLD_SPLIT).map((chunk, i) =>
    IS_BOLD.test(chunk) ? (
      <strong key={i} className="font-bold text-foreground">
        {chunk.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{chunk}</Fragment>
    )
  );
}

/** 맨 URL 을 링크로. 그 밖의 글자는 굵게 처리로 넘긴다. */
function withUrlsAndBold(text: string) {
  return text.split(URL_SPLIT).map((part, i) =>
    IS_URL.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
        {part.replace(/^https?:\/\//, "")}
      </a>
    ) : (
      <Fragment key={i}>{withBold(part)}</Fragment>
    )
  );
}

export function RichText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={`whitespace-pre-line ${className}`}>
      {text.split(LINK_SPLIT).map((part, i) => {
        const link = LINK_PARTS.exec(part);
        if (!link) return <Fragment key={i}>{withUrlsAndBold(part)}</Fragment>;

        const [, label, href] = link;
        // 사이트 안 링크는 새 탭으로 열지 않는다 — 같은 창에서 이어 읽는 흐름이다.
        // 그리고 Link 로 보낸다: 맨 <a> 면 페이지를 통째로 다시 받아 와 느리다.
        if (!IS_URL.test(href)) {
          return (
            <Link key={i} href={href} className={LINK_CLASS}>
              {withBold(label)}
            </Link>
          );
        }
        return (
          <a key={i} href={href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
            {withBold(label)}
          </a>
        );
      })}
    </span>
  );
}
