'use client';

import React, { useState } from 'react';
import { EditorContent } from '@tiptap/react';
import ImageUrlDialog from '@/components/imageUrlDialog';
import { IconButton } from './iconButton';
import { useRichMailEditor } from '@/hooks/useRichMailEditor';
import { Bold, Italic, Underline, Link2, Image as ImageIcon, Minus, List, ListOrdered, Eye, Pencil } from 'lucide-react';

import type { JSONContent } from '@tiptap/react';

type Properties = {
    initialJson?: JSONContent | null;
    onSave?: (payload: { json: JSONContent; html: string }) => Promise<void> | void;
};

export default function RichMailEditor({ initialJson, onSave }: Properties) {
    const [imageDialogOpen, setImageDialogOpen] = useState(false);
    const [imageUrl, setImageUrl] = useState('');
    const [imageAlt, setImageAlt] = useState('');
    const [previewMode, setPreviewMode] = useState<'editor' | 'html'>('editor');
    const [lastSaved, setLastSaved] = useState<string>('');

    const { editor, sanitizedHtml, currentColor, setCurrentColor, actions } =
        useRichMailEditor(initialJson);

    if (!editor) return <div className="text-slate-600">エディタを初期化中...</div>;

    const handleSave = async () => {
        const json = editor.getJSON();
        const html = sanitizedHtml;
        await onSave?.({ json, html });
        setLastSaved(new Date().toISOString());
    };

    const handleInsertImage = () => {
        const r = actions.insertImage(imageUrl, imageAlt);
        if (!r.ok) {
            if (r.reason === 'invalid-url') alert('画像URLが不正です（http/https のURLを入力してください）');
            return;
        }
        setImageUrl('');
        setImageAlt('');
        setImageDialogOpen(false);
    };

    return (
        <div className="grid gap-3">
            {/* Toolbar（ここは後で Toolbar.tsx に切ってOK） */}
            <div className="flex flex-wrap items-center gap-2 rounded border border-slate-200 p-2">
                <IconButton label="太字" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
                    <Bold className="h-4 w-4" />
                </IconButton>
                <IconButton label="斜体" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
                    <Italic className="h-4 w-4" />
                </IconButton>
                <IconButton label="下線" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
                    <Underline className="h-4 w-4" />
                </IconButton>

                <span className="mx-2 h-5 w-px bg-slate-200" />

                <IconButton label="リンク" active={editor.isActive('link')} onClick={actions.toggleLink}>
                    <Link2 className="h-4 w-4" />
                </IconButton>
                <IconButton label="画像URL" active={false} onClick={() => setImageDialogOpen(true)}>
                    <ImageIcon className="h-4 w-4" />
                </IconButton>
                <IconButton label="区切り線" active={false} onClick={() => editor.chain().focus().setHorizontalRule().run()}>
                    <Minus className="h-4 w-4" />
                </IconButton>

                <span className="mx-2 h-5 w-px bg-slate-200" />

                <label className="flex items-center gap-2 text-sm">
                    文字色
                    <input
                        type="color"
                        value={currentColor}
                        onChange={(e) => {
                            const next = e.target.value;
                            setCurrentColor(next);
                            editor.chain().focus().setColor(next).run();
                        }}
                    />
                </label>

                <span className="mx-2 h-5 w-px bg-slate-200" />

                <IconButton label="箇条書き" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
                    <List className="h-4 w-4" />
                </IconButton>
                <IconButton label="番号付き" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
                    <ListOrdered className="h-4 w-4" />
                </IconButton>

                <div className="ml-auto flex items-center gap-1">
                    <IconButton label="編集" active={previewMode === 'editor'} onClick={() => setPreviewMode('editor')}>
                        <Pencil className="h-4 w-4" />
                    </IconButton>
                    <IconButton label="プレビュー" active={previewMode === 'html'} onClick={() => setPreviewMode('html')}>
                        <Eye className="h-4 w-4" />
                    </IconButton>
                </div>
            </div>

            {/* Body */}
            {previewMode === 'editor' ? (
                <EditorContent editor={editor} />
            ) : (
                <div className="rounded border border-slate-300 p-3">
                    <div className="text-xs text-slate-500 mb-2">プレビュー（サニタイズ済み）</div>
                    <div className="mail-preview" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
                </div>
            )}

            {/* Footer */}
            <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white" onClick={handleSave}>
                    保存（JSON+HTML）
                </button>
                <button type="button" className="rounded border border-slate-300 px-3 py-1.5 text-sm" onClick={actions.copyJson}>
                    JSONコピー
                </button>
                <button type="button" className="rounded border border-slate-300 px-3 py-1.5 text-sm" onClick={actions.pasteJson}>
                    JSON貼り付け復元
                </button>
                {lastSaved && <span className="text-xs text-slate-500 ml-auto">last saved: {lastSaved}</span>}
            </div>

            <ImageUrlDialog
                open={imageDialogOpen}
                imageUrl={imageUrl}
                setImageUrl={setImageUrl}
                imageAlt={imageAlt}
                setImageAlt={setImageAlt}
                onCancel={() => setImageDialogOpen(false)}
                onConfirm={handleInsertImage}
            />
        </div>
    );
}
