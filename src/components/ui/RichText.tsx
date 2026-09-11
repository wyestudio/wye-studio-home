import { Fragment } from "react";

/**
 * 운영자가 어드민에서 입력한 평문을 화면용으로 렌더한다.
 *
 * 줄바꿈을 살리고 URL 을 링크로 만든다. 예전에는 이 내용이 코드 안에
 * JSX 로 들어 있어 링크를 넣으려면 개발자가 필요했다.
 *
 * ⚠️ HTML 을 그대로 넣지 않는다(dangerouslySetInnerHTML 미사용).
 *    어드민 입력이라도 화면에 raw HTML 을 흘릴 이유가 없다.
 */
// ⚠️ split 용(/g)과 판별용을 분리한다. /g 정규식의 .test() 는 lastIndex 를
//    들고 다녀서 같은 문자열에도 true/false 가 번갈아 나온다.
const URL_SPLIT = /(https?:\/\/[^\s<>()]+)/g;
const IS_URL = /^https?:\/\//;

export function RichText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={`whitespace-pre-line ${className}`}>
      {text.split(URL_SPLIT).map((part, i) =>
        IS_URL.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            {part.replace(/^https?:\/\//, "")}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </span>
  );
}
