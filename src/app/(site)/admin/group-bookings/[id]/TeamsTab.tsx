"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AdminBadge, AdminCard, AdminEmpty, AdminNotice, adminButtonClass, adminInputClass } from "@/components/admin/ui";
import {
  TEAM_MAX,
  TEAM_NAME_MAX,
  TEAM_SIZE,
  TEAM_SLOGAN_MAX,
  fillTeams,
  moveMember,
  reconcileTeams,
  suggestTeams,
  teamLabel,
  teamsText,
  type Team,
  type TeamPerson,
} from "@/lib/groupTeams";
import { saveTeams } from "../groupActions";

/**
 * 단체 상세 › 팀 편성 탭(관리자 개편 docs/02 10장).
 *
 * 응답이 오면 **추천 편성**을 먼저 보여준다(저장하지 않는다 — 응답이 올 때마다 새로 계산한다).
 * 한 번이라도 고치면(옮기기 · 팀 수 · 팀명 · 구호) 그때부터 저장되고, 뒤에 들어온 응답은 「미배정」 에 모인다.
 *
 * 옮기는 법은 둘이다: 칩을 **끌어서** 다른 팀에 놓거나, 칩을 **누른 뒤** 옮길 팀의 「여기로」 를 누른다(터치 기기 · 키보드).
 *
 * ⚠️ 여기에는 닉네임과 방수만 온다. 이름 · 전화번호는 오지 않는다.
 * ⚠️ 고칠 때마다 편성 전체를 서버에 저장한다. 서버가 그 단체의 참가자인지 · 두 팀에 들어 있지 않은지 다시 본다.
 */
export function TeamsTab({
  id,
  cancelled,
  people,
  saved,
  leaderRequest,
}: {
  id: string;
  cancelled: boolean;
  people: TeamPerson[];
  /** 저장된 편성. 없으면(null) 추천 편성 상태다. */
  saved: Team[] | null;
  /** 모임장 신청서의 팀 편성 요청('직접 구성해서 전달 · 덜 친한 사람끼리'). 신청서가 없으면 null. */
  leaderRequest: { text: string; custom: boolean } | null;
}) {
  const router = useRouter();
  // 화면의 편성. null 이면 추천을 그때그때 계산해 보여준다.
  const [teams, setTeams] = useState<Team[] | null>(saved);
  // 서버의 편성이 바뀌면(새로고침 · 저장 실패 뒤 되돌리기) 화면도 따라간다.
  const savedKey = JSON.stringify(saved);
  const [seenKey, setSeenKey] = useState(savedKey);
  if (seenKey !== savedKey) {
    setSeenKey(savedKey);
    setTeams(saved);
  }
  const [picked, setPicked] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  // 저장이 겹치지 않게 순서대로 보낸다 — 마지막에 누른 것이 마지막에 저장된다.
  const queue = useRef<Promise<void>>(Promise.resolve());

  const byId = new Map(people.map((p) => [p.id, p]));
  const isSaved = teams !== null;
  const state = teams ? reconcileTeams(teams, people) : { teams: suggestTeams(people), free: [] as string[] };
  const list = state.teams;
  const free = state.free;

  const commit = (next: Team[] | null, message?: string) => {
    setTeams(next);
    setPicked(null);
    setStatus({ ok: true, text: "저장 중…" });
    queue.current = queue.current.then(async () => {
      const res = await saveTeams({ id, teams: next });
      if ("error" in res) {
        setStatus({ ok: false, text: `저장하지 못했습니다 — ${res.error}` });
        // 서버의 상태로 되돌린다.
        router.refresh();
        return;
      }
      setStatus({ ok: true, text: message ?? "저장했습니다." });
    });
  };

  const move = (pid: string, to: number) => {
    const from = list.findIndex((t) => t.members.includes(pid));
    if (from === to) return setPicked(null);
    commit(moveMember(list, pid, to));
  };
  const setCount = (delta: number) => {
    const k = Math.min(TEAM_MAX, Math.max(1, list.length + delta));
    if (k === list.length) return;
    commit(suggestTeams(people, k, list), `${k}팀으로 다시 나눴습니다. 팀명과 구호는 그대로예요.`);
  };
  const setField = (i: number, key: "name" | "slogan", value: string) => {
    if (list[i][key] === value) return;
    commit(list.map((t, k) => (k === i ? { ...t, [key]: value } : t)));
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(teamsText(list, people));
      setStatus({ ok: true, text: "팀 명단을 복사했습니다." });
    } catch {
      setStatus({ ok: false, text: "복사하지 못했습니다. 브라우저의 복사 권한을 확인해주세요." });
    }
  };

  if (people.length === 0) {
    return (
      <AdminCard title="팀 편성">
        <AdminEmpty title="응답이 오면 추천 편성을 보여드려요" hint="참가자 설문 응답이 아직 없습니다. 「설문 · 문자」 탭에서 참가자용 링크를 전달하세요." />
      </AdminCard>
    );
  }

  const pickedPerson = picked ? byId.get(picked) : null;

  return (
    <div className="flex flex-col gap-4">
      {leaderRequest && (
        <AdminNotice title={`모임장 요청 · ${leaderRequest.text}`}>
          {leaderRequest.custom ? "모임장이 보내준 구성에 맞춰 끌어서 맞추세요." : "아래 추천을 바탕으로 필요한 만큼만 고치세요."}
        </AdminNotice>
      )}

      <AdminCard title={`${list.length}팀 · ${people.length}명`}>
        <div className="flex flex-wrap items-center gap-2">
          <AdminBadge tone={isSaved ? "progress" : "idle"}>{isSaved ? "직접 수정함" : "추천 편성"}</AdminBadge>
          <span className="text-body-sm text-muted">
            {isSaved ? "저장된 편성입니다. 뒤에 들어온 응답은 미배정에 모입니다." : "아직 고치지 않았습니다. 응답이 올 때마다 추천을 새로 계산합니다."}
          </span>
        </div>

        {!cancelled && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1" role="group" aria-label="팀 수">
              <button type="button" onClick={() => setCount(-1)} disabled={list.length <= 1} aria-label="팀 수 줄이기" className={adminButtonClass("secondary")}>
                −
              </button>
              <span className="min-w-12 text-center text-body font-semibold tabular-nums text-foreground">{list.length}팀</span>
              <button type="button" onClick={() => setCount(1)} disabled={list.length >= TEAM_MAX} aria-label="팀 수 늘리기" className={adminButtonClass("secondary")}>
                +
              </button>
            </div>
            <button
              type="button"
              onClick={() => commit(suggestTeams(people, undefined, list), "추천대로 다시 나눴습니다. 팀명과 구호는 그대로예요.")}
              className={adminButtonClass("secondary")}
            >
              추천대로 다시
            </button>
            <button type="button" onClick={copy} className={adminButtonClass("secondary")}>
              팀 명단 복사
            </button>
          </div>
        )}
        <p className="mt-2 text-body-sm text-muted">
          팀원을 끌어서 다른 팀에 놓거나, 팀원을 누른 뒤 옮길 팀의 「여기로」 를 누르세요. 팀 수를 바꾸면 추천대로 다시 나눕니다(최대 {TEAM_MAX}팀 · 팀당 {TEAM_SIZE}
          명 권장).
        </p>
        <p className="mt-1 min-h-6 text-body-sm" role="status" aria-live="polite">
          {status && <span className={status.ok ? "text-confirm" : "font-semibold text-danger"}>{status.text}</span>}
        </p>
        {pickedPerson && (
          <p className="mt-1 rounded-lg bg-brand-soft p-2 text-body-sm text-foreground">
            <strong className="font-semibold">{pickedPerson.nick}</strong> 을(를) 옮길 팀의 「여기로」 를 누르세요.{" "}
            <button type="button" onClick={() => setPicked(null)} className="min-h-11 px-1 text-glow underline">
              고르기 취소
            </button>
          </p>
        )}
      </AdminCard>

      {free.length > 0 && (
        <AdminCard title={`미배정 ${free.length}명`}>
          <p className="text-body-sm text-muted">편성을 고친 뒤 들어온 응답입니다. 끌어 넣거나 「자동 배치」 로 인원이 적은 팀부터 넣으세요.</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {free.map((pid) => (
              <Chip key={pid} p={byId.get(pid)!} picked={picked === pid} disabled={cancelled} onPick={() => setPicked(picked === pid ? null : pid)} onDrag={setDragging} />
            ))}
          </ul>
          {!cancelled && (
            <button
              type="button"
              onClick={() => commit(fillTeams(list, free, people), "미배정 인원을 인원이 적은 팀부터 넣었습니다.")}
              className={`${adminButtonClass("primary")} mt-3`}
            >
              자동 배치
            </button>
          )}
        </AdminCard>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((t, i) => {
          const sum = t.members.reduce((a, pid) => a + (byId.get(pid)?.count ?? 0), 0);
          const avg = t.members.length ? Math.round(sum / t.members.length) : 0;
          return (
            <section
              key={i}
              aria-label={teamLabel(t, i)}
              onDragOver={(e) => {
                if (!dragging || cancelled) return;
                e.preventDefault();
                setOver(i);
              }}
              onDragLeave={() => setOver((cur) => (cur === i ? null : cur))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                if (dragging && !cancelled) move(dragging, i);
                setDragging(null);
              }}
              className={`rounded-xl border bg-surface p-4 transition-colors ${over === i ? "border-brand bg-brand-soft" : "border-border"}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-h3 font-semibold text-foreground">{teamLabel(t, i)}</h3>
                <span className="text-body-sm text-muted">
                  {t.members.length}명 · 평균 {avg}방
                </span>
                {t.members.length > TEAM_SIZE && <AdminBadge tone="danger">{TEAM_SIZE}명 초과</AdminBadge>}
              </div>

              <ul className="mt-3 flex min-h-11 flex-wrap gap-2">
                {t.members.map((pid) => (
                  <Chip key={pid} p={byId.get(pid)!} picked={picked === pid} disabled={cancelled} onPick={() => setPicked(picked === pid ? null : pid)} onDrag={setDragging} />
                ))}
                {t.members.length === 0 && <li className="text-body-sm text-muted">팀원이 없어요</li>}
              </ul>

              {picked && !cancelled && !t.members.includes(picked) && (
                <button type="button" onClick={() => move(picked, i)} className={`${adminButtonClass("primary")} mt-3`}>
                  여기로
                </button>
              )}

              <div className="mt-3 grid gap-2">
                <TeamField
                  id={`team-${i}-name`}
                  label="팀명"
                  max={TEAM_NAME_MAX}
                  value={t.name}
                  placeholder={`${i + 1}팀`}
                  disabled={cancelled}
                  onSave={(v) => setField(i, "name", v)}
                />
                <TeamField
                  id={`team-${i}-slogan`}
                  label="팀 구호"
                  max={TEAM_SLOGAN_MAX}
                  value={t.slogan}
                  placeholder="예) 나가자! 1등!"
                  disabled={cancelled}
                  onSave={(v) => setField(i, "slogan", v)}
                />
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

/** 팀원 칩 — 끌 수 있고, 눌러서 고를 수도 있다. 닉네임과 방수만 보인다. */
function Chip({
  p,
  picked,
  disabled,
  onPick,
  onDrag,
}: {
  p: TeamPerson;
  picked: boolean;
  disabled: boolean;
  onPick: () => void;
  onDrag: (id: string | null) => void;
}) {
  return (
    <li>
      <button
        type="button"
        draggable={!disabled}
        disabled={disabled}
        aria-pressed={picked}
        onClick={onPick}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", p.id);
          onDrag(p.id);
        }}
        onDragEnd={() => onDrag(null)}
        className={`flex min-h-11 cursor-grab items-center gap-1.5 rounded-lg border px-3 text-body-sm transition-colors active:cursor-grabbing ${
          picked ? "border-brand bg-brand-soft font-semibold text-foreground" : "border-line bg-surface text-foreground hover:bg-fill"
        }`}
      >
        <b className="font-semibold">{p.nick}</b>
        <span className="tabular-nums text-muted">{p.count}방</span>
      </button>
    </li>
  );
}

/** 팀명 · 구호 — 칸을 벗어나거나 Enter 를 누르면 저장한다. 기호를 막지 않는다(화면 · PPT 에 그대로 쓰는 값). */
function TeamField({
  id,
  label,
  max,
  value,
  placeholder,
  disabled,
  onSave,
}: {
  id: string;
  label: string;
  max: number;
  value: string;
  placeholder: string;
  disabled: boolean;
  onSave: (v: string) => void;
}) {
  const [text, setText] = useState(value);
  // 서버에서 온 값이 바뀌면(추천대로 다시 · 새로고침) 칸도 따라간다.
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setText(value);
  }
  const len = Array.from(text.trim()).length;
  const tooLong = len > max;
  const save = () => {
    const v = text.replace(/\s+/g, " ").trim();
    if (Array.from(v).length > max) return;
    if (v !== text) setText(v);
    onSave(v);
  };
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-body-sm font-semibold text-foreground">
          {label}
        </label>
        <span className={`text-micro tabular-nums ${tooLong ? "text-danger" : "text-muted"}`}>
          {len} / {max}
        </span>
      </div>
      <input
        id={id}
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        maxLength={max * 2}
        placeholder={placeholder}
        autoComplete="off"
        aria-invalid={tooLong}
        className={`${adminInputClass} mt-1`}
      />
      {tooLong && (
        <p role="alert" className="mt-1 text-body-sm text-danger">
          {max}자까지 쓸 수 있어요.
        </p>
      )}
    </div>
  );
}
