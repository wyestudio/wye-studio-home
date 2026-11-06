"use client";

import { useState } from "react";
import { Mark, mergeAttributes } from "@tiptap/core";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import { NOTICE_COLORS, type NoticeColor, toNoticeHtml } from "@/lib/noticeBody";

/**
 * 공지 본문 편집기 — 보이는 그대로 쓴다(2026-11-06 대표님).
 *
 * 버튼은 굵게 · 기울임 · 밑줄 · 취소선 · 색 · 점 목록 · 번호 목록 · 링크 · 소제목 · 구분선 · 표뿐이다.
 * 표의 칸 합치기는 일부러 없다 — 휴대폰에서 깨지기 쉽다(저장할 때 colspan · rowspan 도 걸러진다).
 * 글씨체 · 글자 크기는 일부러 없다 — 공지끼리 모양을 맞추고, 휴대폰에서 글자가 깨지거나
 * 작아지지 않게 사이트 기본을 쓴다.
 * ⚠️ 버튼을 더하면 noticeSanitize.ts 의 허용 목록도 같이 늘린다 — 저장할 때 걸러져 사라진다.
 */

/** 글자 색 — hex 가 아니라 이름(data-color)으로 남긴다. 실제 색은 globals.css `.notice-body` */
const NoticeColorMark = Mark.create({
  name: "noticeColor",
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-color"),
        renderHTML: (attrs) => (attrs.color ? { "data-color": attrs.color } : {}),
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-color]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },
});

const NO_MARKS = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  bullet: false,
  ordered: false,
  heading: false,
  link: false,
  table: false,
  color: null as NoticeColor | null,
};

const SAFE_HREF = /^(https?:\/\/|\/)/;

function ToolButton({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      // 눌러도 본문 칸의 선택 영역이 풀리지 않게
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`min-w-8 rounded-md px-2 py-1 text-body-sm ${active ? "bg-fill-strong text-foreground" : "text-muted hover:bg-fill"}`}
    >
      {children}
    </button>
  );
}

export function NoticeBodyEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [3] },
        code: false,
        codeBlock: false,
        blockquote: false,
        link: { openOnClick: false, autolink: true, protocols: ["http", "https"] },
      }),
      NoticeColorMark,
      // 칸 너비 끌어서 바꾸기는 끈다 — 저장하면 너비가 걸러져 사라지고, 화면 폭은 휴대폰이 정한다
      TableKit.configure({ table: { resizable: false } }),
    ],
    content: toNoticeHtml(value),
    // 서버 렌더 때 그리지 않는다 — 안 그러면 Next 에서 hydration 오류가 난다
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "notice-body min-h-48 px-3 py-2 text-body text-muted outline-none",
        "aria-label": "공지 내용",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // ⚠️ 첫 입력 전에는 selector 의 editor 가 비어 온다 — 그때도 기본값을 돌려줘야 칸이 그려진다
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            underline: e.isActive("underline"),
            strike: e.isActive("strike"),
            bullet: e.isActive("bulletList"),
            ordered: e.isActive("orderedList"),
            heading: e.isActive("heading", { level: 3 }),
            link: e.isActive("link"),
            table: e.isActive("table"),
            color: (e.getAttributes("noticeColor").color as NoticeColor | null) ?? null,
          }
        : NO_MARKS,
  });

  const marks = state ?? NO_MARKS;

  if (!editor) {
    return <div className="min-h-56 rounded-md border border-border bg-background" />;
  }

  const chain = () => editor.chain().focus();

  function openLink() {
    setHref((editor?.getAttributes("link").href as string | undefined) ?? "");
    setLinkError(null);
    setLinkOpen(true);
  }

  function applyLink() {
    const v = href.trim();
    if (!v) {
      chain().extendMarkRange("link").unsetLink().run();
      setLinkOpen(false);
      return;
    }
    if (!SAFE_HREF.test(v)) {
      setLinkError("https:// 로 시작하는 주소나, 사이트 안 주소(/group 처럼 / 로 시작)만 넣을 수 있습니다.");
      return;
    }
    if (editor?.state.selection.empty && !marks.link) {
      setLinkError("링크를 걸 글자를 먼저 드래그해서 고르세요.");
      return;
    }
    chain().extendMarkRange("link").setLink({ href: v }).run();
    setLinkOpen(false);
  }

  return (
    <div className="rounded-md border border-border bg-background">
      <div className="flex flex-wrap items-center gap-1 border-b border-border p-1.5">
        <ToolButton label="굵게" active={marks.bold} onClick={() => chain().toggleBold().run()}>
          <span className="font-extrabold">B</span>
        </ToolButton>
        <ToolButton label="기울임" active={marks.italic} onClick={() => chain().toggleItalic().run()}>
          <span className="italic">I</span>
        </ToolButton>
        <ToolButton label="밑줄" active={marks.underline} onClick={() => chain().toggleUnderline().run()}>
          <span className="underline">U</span>
        </ToolButton>
        <ToolButton label="취소선" active={marks.strike} onClick={() => chain().toggleStrike().run()}>
          <span className="line-through">S</span>
        </ToolButton>

        <span className="mx-1 h-5 w-px bg-border" aria-hidden />

        {NOTICE_COLORS.map((c) => (
          <ToolButton
            key={c.key}
            label={`글자 색 ${c.label}`}
            active={marks.color === c.key}
            // 화면에 그려 둔 상태가 아니라 누르는 순간의 편집기 상태로 판단한다
            onClick={() =>
              editor.getAttributes("noticeColor").color === c.key
                ? chain().unsetMark("noticeColor").run()
                : chain().setMark("noticeColor", { color: c.key }).run()
            }
          >
            <span className="notice-body">
              <span data-color={c.key} className="font-semibold">
                {c.label}
              </span>
            </span>
          </ToolButton>
        ))}

        <span className="mx-1 h-5 w-px bg-border" aria-hidden />

        <ToolButton label="점 목록" active={marks.bullet} onClick={() => chain().toggleBulletList().run()}>
          • 목록
        </ToolButton>
        <ToolButton label="번호 목록" active={marks.ordered} onClick={() => chain().toggleOrderedList().run()}>
          1. 목록
        </ToolButton>
        <ToolButton label="소제목" active={marks.heading} onClick={() => chain().toggleHeading({ level: 3 }).run()}>
          소제목
        </ToolButton>
        <ToolButton label="링크" active={marks.link || linkOpen} onClick={openLink}>
          링크
        </ToolButton>

        <span className="mx-1 h-5 w-px bg-border" aria-hidden />

        <ToolButton label="구분선" onClick={() => chain().setHorizontalRule().run()}>
          구분선
        </ToolButton>
        <ToolButton
          label="표 넣기"
          active={marks.table}
          onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          표
        </ToolButton>

        <span className="mx-1 h-5 w-px bg-border" aria-hidden />

        <ToolButton label="서식 지우기" onClick={() => chain().unsetAllMarks().clearNodes().run()}>
          서식 지우기
        </ToolButton>
      </div>

      {/* 표 안에 커서가 있을 때만 */}
      {marks.table && (
        <div className="flex flex-wrap items-center gap-1 border-b border-border p-1.5">
          <span className="px-1 text-micro text-muted">표</span>
          <ToolButton label="아래에 줄 추가" onClick={() => chain().addRowAfter().run()}>
            줄 추가
          </ToolButton>
          <ToolButton label="이 줄 삭제" onClick={() => chain().deleteRow().run()}>
            줄 삭제
          </ToolButton>
          <ToolButton label="오른쪽에 칸 추가" onClick={() => chain().addColumnAfter().run()}>
            칸 추가
          </ToolButton>
          <ToolButton label="이 칸 삭제" onClick={() => chain().deleteColumn().run()}>
            칸 삭제
          </ToolButton>
          <ToolButton label="첫 줄을 제목 줄로" onClick={() => chain().toggleHeaderRow().run()}>
            제목 줄 켜기/끄기
          </ToolButton>
          <ToolButton label="표 삭제" onClick={() => chain().deleteTable().run()}>
            <span className="text-red-400">표 삭제</span>
          </ToolButton>
        </div>
      )}

      {linkOpen && (
        <div className="space-y-1 border-b border-border p-2">
          <div className="flex gap-2">
            <input
              autoFocus
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-body-sm"
              value={href}
              onChange={(e) => setHref(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyLink();
                }
                if (e.key === "Escape") setLinkOpen(false);
              }}
              placeholder="https://… 또는 /group — 비우고 적용하면 링크를 뗍니다"
            />
            <button type="button" onClick={applyLink} className="rounded-md bg-glow px-3 py-1.5 text-body-sm font-semibold text-glow-foreground">
              적용
            </button>
            <button type="button" onClick={() => setLinkOpen(false)} className="rounded-md border border-border px-3 py-1.5 text-body-sm text-muted">
              취소
            </button>
          </div>
          {linkError && <p className="text-micro text-red-400">{linkError}</p>}
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}
