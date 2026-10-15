"use client";

import { useState, type ReactNode } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import {
  Bold,
  Code2,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Table2,
  Underline,
  Undo2,
  Unlink,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Editor teks berformat untuk blok teks pelajaran.
 *
 * Hanya format yang juga diterima pembersih HTML di server yang ditawarkan
 * di sini, sehingga yang terlihat saat menulis sama dengan yang tersimpan.
 */
export function RichTextEditor({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (html: string) => void;
  label: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          protocols: ["https", "http", "mailto", "tel"],
        },
      }),
      TableKit.configure({ table: { resizable: false } }),
      Placeholder.configure({
        placeholder: "Tulis materi di sini… Pilih teks untuk memberi format.",
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "rich-text px-4 py-3",
        "aria-label": label,
        "aria-multiline": "true",
        role: "textbox",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? "" : editor.getHTML()),
  });

  return (
    <div className="overflow-hidden rounded-md border border-ink-300 bg-white focus-within:border-brand-400">
      {editor ? <Toolbar editor={editor} /> : null}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState("");

  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      h2: editor.isActive("heading", { level: 2 }),
      h3: editor.isActive("heading", { level: 3 }),
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      underline: editor.isActive("underline"),
      strike: editor.isActive("strike"),
      bullet: editor.isActive("bulletList"),
      ordered: editor.isActive("orderedList"),
      quote: editor.isActive("blockquote"),
      code: editor.isActive("codeBlock"),
      link: editor.isActive("link"),
      table: editor.isActive("table"),
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
    }),
  });

  const chain = () => editor.chain().focus();

  function openLink() {
    setHref((editor.getAttributes("link").href as string | undefined) ?? "");
    setLinkOpen(true);
  }

  function applyLink(event: React.FormEvent) {
    event.preventDefault();
    const value = href.trim();
    if (!value) chain().extendMarkRange("link").unsetLink().run();
    else
      chain()
        .extendMarkRange("link")
        .setLink({ href: /^[a-z]+:/i.test(value) ? value : `https://${value}` })
        .run();
    setLinkOpen(false);
  }

  return (
    <div className="border-b border-ink-200 bg-ink-25">
      <div
        role="toolbar"
        aria-label="Format teks"
        className="flex flex-wrap items-center gap-0.5 px-1.5 py-1"
      >
        <Tool label="Judul" active={state.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()}>
          <Heading2 />
        </Tool>
        <Tool label="Subjudul" active={state.h3} onClick={() => chain().toggleHeading({ level: 3 }).run()}>
          <Heading3 />
        </Tool>
        <Divider />
        <Tool label="Tebal" active={state.bold} onClick={() => chain().toggleBold().run()}>
          <Bold />
        </Tool>
        <Tool label="Miring" active={state.italic} onClick={() => chain().toggleItalic().run()}>
          <Italic />
        </Tool>
        <Tool label="Garis bawah" active={state.underline} onClick={() => chain().toggleUnderline().run()}>
          <Underline />
        </Tool>
        <Tool label="Coret" active={state.strike} onClick={() => chain().toggleStrike().run()}>
          <Strikethrough />
        </Tool>
        <Divider />
        <Tool label="Daftar berpoin" active={state.bullet} onClick={() => chain().toggleBulletList().run()}>
          <List />
        </Tool>
        <Tool label="Daftar bernomor" active={state.ordered} onClick={() => chain().toggleOrderedList().run()}>
          <ListOrdered />
        </Tool>
        <Tool label="Kutipan" active={state.quote} onClick={() => chain().toggleBlockquote().run()}>
          <Quote />
        </Tool>
        <Tool label="Blok kode" active={state.code} onClick={() => chain().toggleCodeBlock().run()}>
          <Code2 />
        </Tool>
        <Divider />
        <Tool label="Tautan" active={state.link} onClick={openLink}>
          <Link2 />
        </Tool>
        {state.link ? (
          <Tool label="Hapus tautan" onClick={() => chain().extendMarkRange("link").unsetLink().run()}>
            <Unlink />
          </Tool>
        ) : null}
        <Tool
          label="Sisipkan tabel"
          active={state.table}
          onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          <Table2 />
        </Tool>
        <Tool label="Garis pemisah" onClick={() => chain().setHorizontalRule().run()}>
          <Minus />
        </Tool>
        <Divider />
        <Tool label="Urungkan" disabled={!state.canUndo} onClick={() => chain().undo().run()}>
          <Undo2 />
        </Tool>
        <Tool label="Ulangi" disabled={!state.canRedo} onClick={() => chain().redo().run()}>
          <Redo2 />
        </Tool>
      </div>

      {state.table ? (
        <div className="flex flex-wrap gap-1 border-t border-ink-200 px-2 py-1.5 text-xs">
          <TableAction onClick={() => chain().addRowAfter().run()}>+ Baris</TableAction>
          <TableAction onClick={() => chain().addColumnAfter().run()}>+ Kolom</TableAction>
          <TableAction onClick={() => chain().deleteRow().run()}>− Baris</TableAction>
          <TableAction onClick={() => chain().deleteColumn().run()}>− Kolom</TableAction>
          <TableAction onClick={() => chain().deleteTable().run()}>Hapus tabel</TableAction>
        </div>
      ) : null}

      {linkOpen ? (
        <form
          onSubmit={applyLink}
          className="flex flex-wrap items-center gap-2 border-t border-ink-200 px-2 py-2"
        >
          <Input
            autoFocus
            value={href}
            onChange={(event) => setHref(event.target.value)}
            placeholder="https://contoh.com/halaman"
            aria-label="Alamat tautan"
            className="h-8 min-w-0 flex-1"
            onKeyDown={(event) => {
              if (event.key === "Escape") setLinkOpen(false);
            }}
          />
          <Button type="submit" size="sm">
            Terapkan
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setLinkOpen(false)}>
            Batal
          </Button>
        </form>
      ) : null}
    </div>
  );
}

function Tool({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid size-8 place-items-center rounded text-ink-600 hover:bg-ink-100 hover:text-ink-900 disabled:opacity-40 [&_svg]:size-4",
        active ? "bg-brand-100 text-brand-700 hover:bg-brand-100" : "",
      )}
    >
      {children}
    </button>
  );
}

function TableAction({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-ink-200 bg-white px-2 py-1 font-medium text-ink-700 hover:bg-ink-50"
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-ink-200" />;
}
