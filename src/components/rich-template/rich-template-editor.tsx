"use client";

import { mergeAttributes, Node, type Editor } from "@tiptap/core";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Braces, Heading1, Heading2, Italic, List, Pilcrow, Plus, Redo2, Search, Sparkles, Undo2 } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { docToText, textToDoc } from "@/lib/rich-template/convert";

// Writing a template like in Word: headings, bold, lists, and the fields and
// AI paragraphs as chips. What is stored stays the plain template language
// (lib/rich-template/convert.ts), so everything that reads templates works
// unchanged.

export type EditorField = { key: string; label: string; group?: string };

type Props = {
  value: string;
  onChange: (text: string) => void;
  fields: EditorField[];
  /** Headings, bold, italic and lists. Off for emails, which go out as plain text. */
  formatting?: boolean;
  /** Offer "AI-bekezdés". */
  ai?: boolean;
  /** "+ Új mező": the caller names it; the chip is inserted with the returned key. */
  onNewField?: (label: string) => string | null;
  readOnly?: boolean;
  className?: string;
  minHeight?: string;
  ariaLabel?: string;
};

function makeExtensions(labelOf: () => (key: string) => string, formatting: boolean) {
  const Field = Node.create({
    name: "field",
    group: "inline",
    inline: true,
    atom: true,
    selectable: true,
    // The label is only for display (kept current by the editor); the text stores the key.
    addAttributes: () => ({ key: { default: "", renderHTML: () => ({}) }, label: { default: null, renderHTML: () => ({}) } }),
    parseHTML: () => [{ tag: "span[data-field]", getAttrs: (el) => ({ key: (el as HTMLElement).dataset.field ?? "" }) }],
    renderHTML: ({ node, HTMLAttributes }) => ["span", mergeAttributes(HTMLAttributes, { "data-field": node.attrs.key, class: "tpl-field", contenteditable: "false" }), (node.attrs.label as string | null) ?? labelOf()(node.attrs.key as string)],
    renderText: ({ node }) => `{${node.attrs.key}}`,
  });
  const AiBlock = Node.create({
    name: "aiBlock",
    group: "inline",
    inline: true,
    atom: true,
    selectable: true,
    addAttributes: () => ({ instruction: { default: "", renderHTML: () => ({}) } }),
    parseHTML: () => [{ tag: "span[data-ai]", getAttrs: (el) => ({ instruction: (el as HTMLElement).dataset.ai ?? "" }) }],
    renderHTML: ({ node, HTMLAttributes }) => [
      "span",
      mergeAttributes(HTMLAttributes, { "data-ai": node.attrs.instruction, class: "tpl-ai", contenteditable: "false", title: "AI-bekezdés – dupla kattintással szerkesztheted" }),
      `✦ AI: ${node.attrs.instruction as string}`,
    ],
    renderText: ({ node }) => `[[AI: ${node.attrs.instruction}]]`,
  });
  return [
    StarterKit.configure({
      heading: formatting ? { levels: [1, 2] } : false,
      bold: formatting ? {} : false,
      italic: formatting ? {} : false,
      bulletList: formatting ? {} : false,
      listItem: formatting ? {} : false,
      listKeymap: formatting ? {} : false,
      orderedList: false,
      blockquote: false,
      code: false,
      codeBlock: false,
      horizontalRule: false,
      strike: false,
      underline: false,
      link: false,
    }),
    Field,
    AiBlock,
  ];
}

function FieldMenu({ fields, onPick, onNew, onClose }: { fields: EditorField[]; onPick: (key: string) => void; onNew?: () => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const shown = fields.filter((f) => !q.trim() || f.label.toLowerCase().includes(q.trim().toLowerCase()));
  const groups = [...new Set(shown.map((f) => f.group ?? ""))];
  return (
    <div className="menu-motion absolute top-full left-0 z-30 mt-1 flex max-h-96 w-80 flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-lg" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <label className="relative border-b border-border">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-subtle" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mező keresése" aria-label="Mező keresése" className="h-9 w-full bg-transparent pr-3 pl-8 text-sm focus:outline-none" />
      </label>
      <div className="overflow-y-auto p-1.5">
        {groups.map((g) => (
          <div key={g || "-"}>
            {g && <p className="px-2 pt-2 pb-1 text-[11px] font-medium tracking-wide text-subtle uppercase">{g}</p>}
            {shown
              .filter((f) => (f.group ?? "") === g)
              .map((f) => (
                <button key={f.key} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(f.key)} className="block w-full rounded-lg px-2 py-1.5 text-left text-sm text-ink hover:bg-surface">
                  {f.label}
                </button>
              ))}
          </div>
        ))}
        {!shown.length && <p className="px-2 py-3 text-xs text-muted">Nincs ilyen mező.</p>}
      </div>
      {onNew && (
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onNew} className="flex items-center gap-1.5 border-t border-border px-3 py-2 text-left text-xs font-medium text-accent hover:bg-accent-soft">
          <Plus className="size-3.5" /> Új mező…
        </button>
      )}
    </div>
  );
}

function Tool({ on, active, label, children, disabled }: { on: () => void; active?: boolean; label: string; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={on}
      className={cn("grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-strong hover:text-ink disabled:opacity-40", active && "bg-surface-strong text-ink")}
    >
      {children}
    </button>
  );
}

/** A Word-like editor for templates; reads and writes the template language. */
export function RichTemplateEditor({ value, onChange, fields, formatting = true, ai = true, onNewField, readOnly = false, className, minHeight = "28rem", ariaLabel = "Szöveg" }: Props) {
  const labels = useRef(new Map(fields.map((f) => [f.key, f.label])));
  const labelKey = fields.map((f) => `${f.key}=${f.label}`).join("|");
  useLayoutEffect(() => {
    labels.current = new Map(fields.map((f) => [f.key, f.label]));
  }, [labelKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const labelOf = () => (key: string) => labels.current.get(key) ?? labels.current.get(key.replace(/_szoveg$/, "")) ?? key.replace(/_/g, " ");
  const emitted = useRef(value);
  const [menu, setMenu] = useState(false);
  const extensions = useMemo(() => makeExtensions(() => labelOf(), formatting), [formatting]);

  const editor = useEditor({
    extensions,
    content: textToDoc(value),
    editable: !readOnly,
    immediatelyRender: false,
    editorProps: {
      attributes: { "aria-label": ariaLabel, role: "textbox", "aria-multiline": "true", class: "tpl-doc focus:outline-none" },
      // Double-click an AI chip to change what it should write.
      handleDoubleClickOn: (view, _pos, node, nodePos) => {
        if (node.type.name !== "aiBlock" || !view.editable) return false;
        const next = window.prompt("Mit írjon az AI ebbe a bekezdésbe?", node.attrs.instruction as string);
        if (next?.trim()) view.dispatch(view.state.tr.setNodeMarkup(nodePos, undefined, { instruction: next.trim() }));
        return true;
      },
    },
    onUpdate: ({ editor: e }) => {
      const text = docToText(e.getJSON());
      emitted.current = text;
      onChange(text);
    },
  });

  // A new text from outside (an upload, a reset) replaces the content.
  useEffect(() => {
    if (!editor || value === emitted.current) return;
    emitted.current = value;
    editor.commands.setContent(textToDoc(value), { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  // Chip labels follow renamed fields: a chip is redrawn only when its node changes, so update the display label.
  const drawnLabels = useRef(labelKey);
  useEffect(() => {
    if (!editor || editor.isDestroyed || drawnLabels.current === labelKey) return;
    drawnLabels.current = labelKey;
    const tr = editor.state.tr;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name !== "field") return;
      const label = labelOf()(node.attrs.key as string);
      if (node.attrs.label !== label) tr.setNodeMarkup(pos, undefined, { ...node.attrs, label });
    });
    if (tr.docChanged) editor.view.dispatch(tr.setMeta("addToHistory", false));
  }, [editor, labelKey]);

  const state = useEditorState({
    editor,
    selector: ({ editor: e }: { editor: Editor | null }) => ({
      h1: e?.isActive("heading", { level: 1 }) ?? false,
      h2: e?.isActive("heading", { level: 2 }) ?? false,
      bold: e?.isActive("bold") ?? false,
      italic: e?.isActive("italic") ?? false,
      list: e?.isActive("bulletList") ?? false,
      undo: e?.can().undo() ?? false,
      redo: e?.can().redo() ?? false,
    }),
  });

  const insertField = (key: string, label?: string) => {
    editor?.chain().focus().insertContent([{ type: "field", attrs: { key, label: label ?? labelOf()(key) } }, { type: "text", text: " " }]).run();
    setMenu(false);
  };

  return (
    <div className={cn("flex min-w-0 flex-col rounded-3xl border border-border bg-background", className)}>
      {!readOnly && (
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-0.5 rounded-t-3xl border-b border-border bg-surface/95 px-2 py-1.5 backdrop-blur">
          <Tool label="Visszavonás" on={() => editor?.chain().focus().undo().run()} disabled={!state?.undo}>
            <Undo2 className="size-4" />
          </Tool>
          <Tool label="Újra" on={() => editor?.chain().focus().redo().run()} disabled={!state?.redo}>
            <Redo2 className="size-4" />
          </Tool>
          {formatting && (
            <>
              <span className="mx-1 h-5 w-px bg-border" />
              <Tool label="Cím" active={state?.h1} on={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>
                <Heading1 className="size-4" />
              </Tool>
              <Tool label="Alcím" active={state?.h2} on={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
                <Heading2 className="size-4" />
              </Tool>
              <Tool label="Normál szöveg" on={() => editor?.chain().focus().setParagraph().run()}>
                <Pilcrow className="size-4" />
              </Tool>
              <span className="mx-1 h-5 w-px bg-border" />
              <Tool label="Félkövér (Ctrl+B)" active={state?.bold} on={() => editor?.chain().focus().toggleBold().run()}>
                <Bold className="size-4" />
              </Tool>
              <Tool label="Dőlt (Ctrl+I)" active={state?.italic} on={() => editor?.chain().focus().toggleItalic().run()}>
                <Italic className="size-4" />
              </Tool>
              <Tool label="Felsorolás" active={state?.list} on={() => editor?.chain().focus().toggleBulletList().run()}>
                <List className="size-4" />
              </Tool>
            </>
          )}
          <span className="mx-1 h-5 w-px bg-border" />
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setMenu((m) => !m)}
              aria-expanded={menu}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-ink hover:bg-surface-strong"
            >
              <Braces className="size-3.5" /> Mező beszúrása
            </button>
            {menu && (
              <FieldMenu
                fields={fields}
                onPick={insertField}
                onClose={() => setMenu(false)}
                onNew={
                  onNewField
                    ? () => {
                        const name = window.prompt("Az új mező neve (pl. Közös költség):")?.trim();
                        const key = name ? onNewField(name) : null;
                        if (key) insertField(key, name);
                      }
                    : undefined
                }
              />
            )}
          </div>
          {ai && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const instruction = window.prompt("Mit írjon az AI ebbe a bekezdésbe? (pl. írj egy rövid, személyes mondatot az ügyfél kereséséről)")?.trim();
                if (instruction) editor?.chain().focus().insertContent({ type: "aiBlock", attrs: { instruction } }).run();
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-accent hover:bg-accent-soft"
            >
              <Sparkles className="size-3.5" /> AI-bekezdés
            </button>
          )}
        </div>
      )}
      <EditorContent
        editor={editor}
        style={{ minHeight }}
        className={cn(
          "flex-1 cursor-text px-6 py-5 text-[14.5px] leading-relaxed text-text sm:px-10",
          formatting && "font-serif",
          "[&_.tpl-doc]:min-h-[inherit] [&_.tpl-doc_h1]:mb-2 [&_.tpl-doc_h1]:text-center [&_.tpl-doc_h1]:text-2xl [&_.tpl-doc_h1]:font-semibold! [&_.tpl-doc_h1]:text-ink [&_.tpl-doc_h2]:mt-5 [&_.tpl-doc_h2]:mb-2 [&_.tpl-doc_h2]:text-base [&_.tpl-doc_h2]:font-semibold! [&_.tpl-doc_h2]:text-ink",
          "[&_.tpl-doc_p]:mb-3 [&_.tpl-doc_strong]:font-semibold [&_.tpl-doc_strong]:text-ink [&_.tpl-doc_ul]:mb-3 [&_.tpl-doc_ul]:list-disc [&_.tpl-doc_ul]:pl-6 [&_.tpl-doc_li_p]:mb-1",
          "[&_.tpl-field]:mx-px [&_.tpl-field]:inline-block [&_.tpl-field]:rounded-md [&_.tpl-field]:bg-accent-soft [&_.tpl-field]:px-1.5 [&_.tpl-field]:font-sans [&_.tpl-field]:text-[12.5px] [&_.tpl-field]:leading-6 [&_.tpl-field]:font-medium [&_.tpl-field]:text-accent",
          "[&_.tpl-ai]:my-0.5 [&_.tpl-ai]:inline-block [&_.tpl-ai]:rounded-lg [&_.tpl-ai]:border [&_.tpl-ai]:border-dashed [&_.tpl-ai]:border-accent/40 [&_.tpl-ai]:bg-accent-soft/50 [&_.tpl-ai]:px-2 [&_.tpl-ai]:py-0.5 [&_.tpl-ai]:font-sans [&_.tpl-ai]:text-[12.5px] [&_.tpl-ai]:text-accent",
          "[&_.ProseMirror-selectednode]:ring-2 [&_.ProseMirror-selectednode]:ring-accent/50",
        )}
      />
    </div>
  );
}
