'use client';

import React, { useState } from 'react';
import { EditorContent } from '@tiptap/react';
import ImageUrlDialog from '@/components/imageUrlDialog';
import LinkDialog from '@/components/linkDialog';
import { IconButton } from './iconButton';
import { useRichMailEditor } from '@/hooks/useRichMailEditor';
import { Bold, Italic, Underline, Link2, Image as ImageIcon, Minus, List, ListOrdered, Eye, Pencil } from 'lucide-react';

import type { JSONContent } from '@tiptap/react';



type Properties = {
    open?: boolean;
    initialJson?: JSONContent | null;
    onSave?: (payload: { json: JSONContent; html: string }) => Promise<void> | void;
    forcePreview?: boolean;
    readOnly?: boolean;
};

export default function RichMailEditor({ initialJson, open, onSave, forcePreview = false, readOnly = false }: Properties) {

    const [imageDialogOpen, setImageDialogOpen] = useState(false);
    const [linkDialogOpen, setLinkDialogOpen] = useState(false);
    const [imageUrl, setImageUrl] = useState('');
    const [imageAlt, setImageAlt] = useState('');
    const [linkUrl, setLinkUrl] = useState('');
    const [previewMode, setPreviewMode] = useState<'editor' | 'html'>(forcePreview ? 'html' : 'editor');
    const [lastSaved, setLastSaved] = useState<string>('');

    const { editor, sanitizedHtml, currentColor, setCurrentColor, imageUrlActions, linkActions } =
        useRichMailEditor(initialJson, { editable: !readOnly });

    if (!editor) return <div className="text-slate-600">エディタを初期化中...</div>;
    if (open === false) return null;
    const BASIC_COLORS = [
        { name: '黒', value: '#000000' },
        { name: '濃いグレー', value: '#334155' },
        { name: 'グレー', value: '#64748b' },
        { name: '赤', value: '#ef4444' },
        { name: '橙', value: '#f97316' },
        { name: '黄', value: '#eab308' },
        { name: '緑', value: '#22c55e' },
        { name: '青', value: '#3b82f6' },
        { name: '紫', value: '#a855f7' },
    ] as const;
    const applyColor = async (next: string) => {
        if (readOnly) return;
        setCurrentColor(next);
        editor.chain().focus().setColor(next).run();
    };

    const handleSave = async () => {
        if (readOnly) return;
        const json = editor.getJSON();
        const html = sanitizedHtml;
        await onSave?.({ json, html });
        setLastSaved(new Date().toISOString());
    };

    const handleInsertImage = () => {
        const r = imageUrlActions.insertImage(imageUrl, imageAlt);
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
            <div className="flex flex-wrap items-center gap-2 rounded border border-slate-200 p-2">
                <IconButton label="太字" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} disabled={readOnly}>
                    <Bold className="h-4 w-4" />
                </IconButton>
                <IconButton label="斜体" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} disabled={readOnly}>
                    <Italic className="h-4 w-4" />
                </IconButton>
                <IconButton label="下線" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} disabled={readOnly}>
                    <Underline className="h-4 w-4" />
                </IconButton>

                <span className="mx-2 h-5 w-px bg-slate-200" />

                <IconButton label="リンク" active={editor.isActive('link')} onClick={() => setLinkDialogOpen(true)} disabled={readOnly}>
                    <Link2 className="h-4 w-4" />
                </IconButton>
                <IconButton label="画像URL" active={false} onClick={() => setImageDialogOpen(true)} disabled={readOnly}>
                    <ImageIcon className="h-4 w-4" />
                </IconButton>

                <span className="mx-2 h-5 w-px bg-slate-200" />
                <span className="text-sm text-slate-600">文字色</span>

                {/* 基本色 */}
                <div className="flex items-center gap-1">
                    {BASIC_COLORS.map((c) => {
                        const active = currentColor.toLowerCase() === c.value.toLowerCase();
                        return (
                            <button
                                key={c.value}
                                type="button"
                                title={c.name}
                                aria-label={`文字色: ${c.name}`}
                                onClick={() => applyColor(c.value)}
                                className={[
                                    'h-6 w-6 rounded border transition',
                                    active ? 'border-slate-900 ring-2 ring-slate-900/30' : 'border-slate-300 hover:ring-2 hover:ring-slate-400/20',
                                ].join(' ')}
                                style={{ backgroundColor: c.value }}
                            />
                        );
                    })}
                </div>

                {/* 自由選択 */}
                <input
                    type="color"
                    value={currentColor}
                    onChange={(e) => applyColor(e.target.value)}
                    className="h-8 w-10 cursor-pointer rounded border border-slate-300 bg-white p-1"
                    title="カスタム色"
                    aria-label="文字色（カスタム）"
                    disabled={readOnly}
                />

                <div className="flex items-center gap-2">
                    <IconButton label="箇条書き" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} disabled={readOnly}>
                        <List className="h-4 w-4" />
                    </IconButton>
                    <IconButton label="番号付き" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} disabled={readOnly}>
                        <ListOrdered className="h-4 w-4" />
                    </IconButton>
                    <IconButton label="区切り線" active={false} onClick={() => editor.chain().focus().setHorizontalRule().run()} disabled={readOnly}>
                        <Minus className="h-4 w-4" />
                    </IconButton>
                </div>



                <div className="ml-auto flex items-center gap-1">
                    <IconButton label="編集" active={previewMode === 'editor'} onClick={() => setPreviewMode('editor')} disabled={forcePreview || readOnly}>
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
                    <div className="text-xs text-slate-500 mb-2">プレビュー</div>
                    <div className="mail-preview" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
                </div>
            )}

            {/* Footer */}
            {!readOnly && (
                <div className="flex flex-wrap items-center gap-2">
                    <button type="button" className={`
                                            inline-flex items-center justify-center
                                            rounded-md px-6 py-2
                                            text-base font-medium text-blue-600
                                            hover:bg-blue-100
                                            disabled:opacity-50
                                        `} onClick={handleSave}>
                        保存
                    </button>
                    {lastSaved && <span className="text-xs text-slate-500 ml-auto">last saved: {lastSaved}</span>}
                </div>
            )}

            <ImageUrlDialog
                open={imageDialogOpen && !readOnly}
                imageUrl={imageUrl}
                setImageUrl={setImageUrl}
                imageAlt={imageAlt}
                setImageAlt={setImageAlt}
                onCancel={() => setImageDialogOpen(false)}
                onConfirm={handleInsertImage}
            />

            <LinkDialog
                open={linkDialogOpen && !readOnly}
                linkUrl={linkUrl}
                setLinkUrl={setLinkUrl}
                onCancel={() => setLinkDialogOpen(false)}
                onConfirm={(linkUrl) => {
                    linkActions.toggleLink(linkUrl);
                    setLinkDialogOpen(false);
                }}
            />
        </div>
    );
}
