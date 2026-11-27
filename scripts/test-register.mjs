// `npm test` 가 쓰는 준비 파일 — Node 기본 테스트 기능(node --test)으로 src 의 *.test.ts 를 돌린다.
// 테스트 도구를 따로 설치하지 않는다(2026-11-27 대표님). Node 가 TypeScript 의 타입 표기를 그냥 지우고 실행한다.
//
// 이 파일이 하는 일은 하나다: 저장소의 import 별칭 "@/…" 을 src/… 의 .ts 파일로 풀어 준다.
// (Next 는 tsconfig 의 paths 로 풀지만 Node 는 그 설정을 모른다.)
// ⚠️ 그래서 테스트 대상은 React · next/* 를 import 하지 않는 순수 계산 모듈이어야 한다.
import { registerHooks } from "node:module";

const SRC = new URL("../src/", import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const path = specifier.slice(2);
      return nextResolve(new URL(/\.[cm]?[jt]sx?$/.test(path) ? path : `${path}.ts`, SRC).href, context);
    }
    return nextResolve(specifier, context);
  },
});
