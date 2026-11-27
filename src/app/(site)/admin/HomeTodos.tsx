"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Chevron } from "@/components/ui/Chevron";
import { AdminBadge, adminButtonClass, adminInputClass } from "@/components/admin/ui";
import { TODO_TABS, TODO_TEXT_MAX, sortTodos, type HomeTodo, type TodoTab } from "@/lib/adminTodos";
import { charCount, cleanLine } from "@/lib/textClean";
import { addTodo, deleteTodo, setAutoTodoDone, setTodoDone } from "./todoActions";

/**
 * 홈 「오늘 할 일」 — "지금 내가 뭘 해야 하나" 가 홈의 첫 번째다(2026-11-27 대표님: 너무너무 중요).
 *
 * 한 줄 = 무엇을 · 어느 건 · 왜 지금. 누르면 그 일을 처리하는 화면으로 간다.
 * 탭(전체 / 확인 / 문자 / 준비)마다 **남은** 개수를 적는다. 끝낸 일은 아래로 내려가 흐려진다.
 *
 * ⚠️ 탭은 주소를 바꾸지 않는다 — 탭을 누를 때마다 서버가 홈을 다시 그릴 이유가 없다(wye-server-cost).
 * ⚠️ 체크 · 등록 · 삭제 뒤에만 router.refresh() 로 한 번 다시 읽는다.
 */
export function HomeTodos({ todos }: { todos: HomeTodo[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"all" | TodoTab>("all");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  // 체크를 누른 즉시 화면에 반영한다(서버 답을 기다리는 동안 멈춘 것처럼 보이지 않게). 키 → 끝냄 여부.
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});

  const view = todos.map((t) => (t.key in optimistic ? { ...t, done: optimistic[t.key] } : t));
  const remaining = (k: "all" | TodoTab) => view.filter((t) => !t.done && (k === "all" || t.tab === k)).length;
  const list = sortTodos(view.filter((t) => tab === "all" || t.tab === tab));

  const run = (job: () => Promise<{ error: string } | { success: true }>, onFail?: () => void) =>
    startTransition(async () => {
      const res = await job();
      if ("error" in res) {
        setError(res.error);
        onFail?.();
        return;
      }
      setError("");
      router.refresh();
    });

  const toggle = (t: HomeTodo) => {
    const next = !t.done;
    setOptimistic((o) => ({ ...o, [t.key]: next }));
    const undo = () => setOptimistic((o) => ({ ...o, [t.key]: !next }));
    run(() => (t.manualId ? setTodoDone(t.manualId, next) : setAutoTodoDone(t.key, next)), undo);
  };

  const cleaned = cleanLine(text);
  const tooLong = charCount(cleaned) > TODO_TEXT_MAX;
  const submit = () => {
    if (!cleaned) return setError("할 일을 적어주세요.");
    if (tooLong) return setError(`${TODO_TEXT_MAX}자까지 쓸 수 있어요.`);
    run(async () => {
      const res = await addTodo(cleaned);
      if (!("error" in res)) setText("");
      return res;
    });
  };

  return (
    <section aria-labelledby="home-todos-title" className="rounded-xl border border-border bg-surface p-4 md:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="home-todos-title" className="text-h3 font-semibold text-foreground">
          오늘 할 일
        </h2>
        <p className="text-body-sm text-muted">급한 순서대로 나옵니다</p>
      </div>

      {/* 탭 — 좁은 화면에서 넘치면 탭 줄만 옆으로 민다 */}
      <div className="mb-3 overflow-x-auto">
        <div role="tablist" aria-label="할 일 종류" className="flex min-w-max gap-1.5">
          {TODO_TABS.map((t) => {
            const active = tab === t.key;
            const n = remaining(t.key);
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={`flex min-h-11 items-center gap-1.5 rounded-full px-4 text-label font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  active ? "bg-foreground text-background" : "border border-border text-muted hover:text-foreground"
                }`}
              >
                {t.label}
                <span className={`tabular-nums ${active ? "" : n > 0 ? "text-foreground" : ""}`}>{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      {list.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-6 text-center text-body-sm text-muted">
          {tab === "sms"
            ? "지금 보낼 안내 문자가 없어요. 단체의 7일 전 · 하루 전 안내 때가 되면 여기에 올라옵니다."
            : "지금 할 일이 없어요. 아래에서 직접 적어 둘 수 있습니다."}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {list.map((t) => (
            <li key={t.key} className={`flex items-center gap-2 py-1 ${t.done ? "opacity-50" : ""}`}>
              {t.checkable ? (
                // 체크칸은 작아도 누르는 영역은 44×44 다
                <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center">
                  <input
                    type="checkbox"
                    checked={t.done}
                    disabled={pending}
                    onChange={() => toggle(t)}
                    aria-label={`${t.title} 끝냄`}
                    className="h-5 w-5 accent-current"
                  />
                </label>
              ) : (
                // 건수 줄 — 체크할 수 없다. 처리해서 0건이 되면 사라진다
                <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center">
                  <span className="h-2 w-2 rounded-full bg-danger" />
                </span>
              )}

              <TodoBody t={t} />

              {t.manualId && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => deleteTodo(t.manualId!))}
                  className="min-h-11 shrink-0 rounded-lg px-3 text-body-sm text-muted hover:text-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  삭제
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* 직접 적기 */}
      <form
        className="mt-4 flex flex-wrap items-start gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="min-w-0 flex-1 basis-56">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={TODO_TEXT_MAX * 2}
            placeholder="할 일 직접 적기"
            aria-label="할 일 직접 적기"
            aria-invalid={tooLong}
            autoComplete="off"
            className={adminInputClass}
          />
          <p className={`mt-1 text-right text-micro tabular-nums ${tooLong ? "text-danger" : "text-muted"}`}>
            {charCount(cleaned)} / {TODO_TEXT_MAX}
          </p>
        </div>
        <button type="submit" disabled={pending} className={adminButtonClass("secondary")}>
          {pending ? "등록 중…" : "할 일 등록"}
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-1 text-body-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}

function TodoBody({ t }: { t: HomeTodo }) {
  const body = (
    <>
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
        {t.scope && <AdminBadge tone={t.scope === "단체" ? "progress" : "idle"}>{t.scope}</AdminBadge>}
        <span className={`min-w-0 text-body-sm font-semibold text-foreground ${t.done ? "line-through" : ""}`}>{t.title}</span>
      </span>
      <span className="mt-0.5 block text-body-sm text-muted">{t.sub}</span>
    </>
  );
  if (!t.href) return <div className="min-w-0 flex-1 py-2">{body}</div>;
  return (
    <Link
      href={t.href}
      className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg py-2 pr-1 hover:bg-fill-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <span className="min-w-0 flex-1">{body}</span>
      <Chevron className="h-4 w-4 shrink-0 text-muted" />
    </Link>
  );
}
