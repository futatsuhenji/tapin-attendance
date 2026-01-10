'use client';

import React, { useMemo, useState, useEffect } from 'react';
import DOMPurify from 'isomorphic-dompurify';
import { useEditor, EditorContent, JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import HardBreak from '@tiptap/extension-hard-break';
import { Extension } from '@tiptap/core';


const EnterAsHardBreak = Extension.create({
    name: 'enterAsHardBreak',
    addKeyboardShortcuts() {
        return {
            Enter: () => {
                const view = this.editor.view;

                const isComposing =
                    view !== undefined &&
                    'composing' in view &&
                    Boolean((view as { composing?: boolean }).composing);

                // IME変換確定などのときは邪魔しない（日本語入力対策）
                if (isComposing) return false;
                return this.editor.commands.setHardBreak();
            },
            'Shift-Enter': () => {
                // 段落分けをしたいなら Shift+Enter を splitBlock にする
                return this.editor.commands.splitBlock();
            },
        };
    },
});



type Properties = {
    /**
     * DBに保存してあるcustomDataJson（Tiptap JSON）を渡す想定
     * null/undefinedなら空で開始
     */
    initialJson?: JSONContent | null;

    /**
     * 保存ボタン押下時のコールバック
     * ここで API に POST するなど
     */
    onSave?: (payload: { json: JSONContent; html: string }) => Promise<void> | void;
};




function isSafeHttpUrl(url: string): boolean {
    try {
        const u = new URL(url);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;

        // ハッカソン仕様の最低限: data: を拒否、画像拡張子っぽいものを推奨（厳格にはしない）
        // クエリ付きでもOKにしたいので pathname のみ見る
        const path = u.pathname.toLowerCase();
        const looksLikeImage = /\.(png|jpe?g|webp|gif|svg)$/.test(path);
        // ここを厳密にするなら looksLikeImage === true を必須にする
        return looksLikeImage;
    } catch {
        return false;
    }
}

export default function richMailEditor({ initialJson, onSave }: Properties) {
    const [imageDialogOpen, setImageDialogOpen] = useState(false);
    const [imageUrl, setImageUrl] = useState('');
    const [imageAlt, setImageAlt] = useState('');
    const [previewMode, setPreviewMode] = useState<'editor' | 'html'>('editor');
    const [lastSaved, setLastSaved] = useState<string>('');
    const [currentColor, setCurrentColor] = useState('#000000');
    const [blockType, setBlockType] = useState<BlockType>('p');
    type BlockType = 'p' | 'h1' | 'h2' | 'h3';
    type HeadingLevel = 1 | 2 | 3;
    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [1, 2, 3],
                },
                hardBreak: false, // 独自に定義するため無効化
            }),
            HardBreak.configure({
                keepMarks: true,
            }),
            EnterAsHardBreak,
            Link.configure({
                openOnClick: false,
                autolink: true,
                linkOnPaste: true,
            }),
            Image.configure({
                inline: false,
                allowBase64: false, // data: は基本拒否（メール用途なら安全）
            }),
            HorizontalRule,
            TextStyle,
            Color,
        ],
        content: initialJson ?? {
            type: 'doc',
            content: [
                { type: 'paragraph', content: [{ type: 'text', text: '' }] },
            ],
        },
        editorProps: {
            attributes: {
                class:
                    'tiptap min-h-[260px] rounded border border-slate-300 p-3 focus:outline-none',
            },
        },
    });

    const rawHtml = editor?.getHTML() ?? '';
    const sanitizedHtml = useMemo(() => {
        // 許可タグ/属性を最低限に絞る（メール用途の基本）
        return DOMPurify.sanitize(rawHtml, {
            ALLOWED_TAGS: [
                'p',
                'br',
                'strong',
                'em',
                'u',
                'a',
                'img',
                'hr',
                'ul',
                'ol',
                'li',
                'span',
                'h1',
                'h2',
                'h3',
            ],
            ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'style'],
            // style を許すのは最低限の見た目用（色など）。
        });
    }, [rawHtml]);

    const handleInsertImage = () => {
        if (!editor) return;
        const url = imageUrl.trim();
        const alt = imageAlt.trim();

        if (!isSafeHttpUrl(url)) {
            alert('画像URLが不正です（http/https のURLを入力してください）');
            return;
        }

        editor.chain().focus().setImage({ src: url, alt: alt || undefined }).run();

        setImageUrl('');
        setImageAlt('');
        setImageDialogOpen(false);
    };

    const handleToggleLink = () => {
        if (!editor) return;

        const previousUrl = editor.getAttributes('link').href as string | undefined;
        const url = globalThis.prompt('リンクURLを入力してください', previousUrl ?? 'https://');

        if (url === null) return; // cancel
        const trimmed = url.trim();

        if (trimmed === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }

        // 最低限: http/https のみに限定（mailtoを許すなら追加）
        if (!isSafeHttpUrl(trimmed)) {
            alert('リンクURLが不正です（http/https のURLを入力してください）');
            return;
        }

        editor
            .chain()
            .focus()
            .extendMarkRange('link')
            .setLink({ href: trimmed, target: '_blank', rel: 'noopener noreferrer' })
            .run();
    };

    const handleSave = async () => {
        if (!editor) return;
        const json = editor.getJSON();
        const html = sanitizedHtml;

        await onSave?.({ json, html });

        setLastSaved(new Date().toISOString());
    };

    const handleCopyJson = async () => {
        if (!editor) return;
        const jsonStr = JSON.stringify(editor.getJSON(), null, 2);
        await navigator.clipboard.writeText(jsonStr);
        alert('JSONをクリップボードにコピーしました');
    };

    const handlePasteJson = async () => {
        if (!editor) return;
        const jsonString = globalThis.prompt('貼り付けるTiptap JSONを入力してください（全体を貼り付け）');
        if (!jsonString) return;

        try {
            const parsed = JSON.parse(jsonString) as JSONContent;
            editor.commands.setContent(parsed);
            alert('JSONから復元しました');
        } catch {
            alert('JSONの形式が不正です');
        }
    };
    useEffect(() => {
        if (!editor) return;

        const syncBlockType = () => {
            if (editor.isActive('heading', { level: 1 })) {
                setBlockType('h1');
            } else if (editor.isActive('heading', { level: 2 })) {
                setBlockType('h2');
            } else if (editor.isActive('heading', { level: 3 })) {
                setBlockType('h3');
            } else {
                setBlockType('p');
            }
        };

        syncBlockType();
        editor.on('selectionUpdate', syncBlockType);
        editor.on('transaction', syncBlockType);

        return () => {
            editor.off('selectionUpdate', syncBlockType);
            editor.off('transaction', syncBlockType);
        };
    }, [editor]);


    useEffect(() => {
        if (!editor) return;

        const sync = () => {
            const c = editor.getAttributes('textStyle')?.color;
            setCurrentColor((c && typeof c === 'string') ? c : '#000000');
        };

        // 初回同期
        sync();

        // カーソル移動や選択変更で同期（これが重要）
        editor.on('selectionUpdate', sync);
        // マーク変更・入力などでも同期
        editor.on('transaction', sync);

        return () => {
            editor.off('selectionUpdate', sync);
            editor.off('transaction', sync);
        };
    }, [editor]);

    if (!editor) {
        return <div className="text-slate-600">エディタを初期化中...</div>;
    }



    return (
        <div className="grid gap-3">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 rounded border border-slate-200 p-2">
                <button
                    type="button"
                    className="rounded border border-slate-300 px-2 py-1 text-sm"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                >
                    太字
                </button>
                <button
                    type="button"
                    className="rounded border border-slate-300 px-2 py-1 text-sm"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                >
                    斜体
                </button>
                <button
                    type="button"
                    className="rounded border border-slate-300 px-2 py-1 text-sm"
                    onClick={() => editor.chain().focus().toggleUnderline?.().run()}
                    disabled={typeof editor.chain().focus().toggleUnderline !== 'function'}
                    title="UnderlineはStarterKitに含まれないため、必要なら拡張追加で有効化してください"
                >
                    下線（任意）
                </button>

                <label className="flex items-center gap-2 text-sm">
                    見出し
                    <select
                        className="rounded border border-slate-300 px-2 py-1 text-sm"
                        value={blockType}
                        onChange={(e) => {
                            const v = e.target.value as BlockType;
                            setBlockType(v);

                            if (v === 'p') {
                                editor.chain().focus().setParagraph().run();
                                return;
                            }

                            const level = Number(v.slice(1)) as HeadingLevel; // 'h1' -> 1
                            editor.chain().focus().toggleHeading({ level }).run();
                        }}
                    >
                        <option value="p">本文</option>
                        <option value="h2">見出し 2</option>
                        <option value="h3">見出し 3</option>
                    </select>

                </label>


                <span className="mx-2 h-5 w-px bg-slate-200" />

                <button
                    type="button"
                    className="rounded border border-slate-300 px-2 py-1 text-sm"
                    onClick={handleToggleLink}
                >
                    リンク
                </button>

                <button
                    type="button"
                    className="rounded border border-slate-300 px-2 py-1 text-sm"
                    onClick={() => setImageDialogOpen(true)}
                >
                    画像URL
                </button>

                <button
                    type="button"
                    className="rounded border border-slate-300 px-2 py-1 text-sm"
                    onClick={() => editor.chain().focus().setHorizontalRule().run()}
                >
                    区切り線
                </button>

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

                <button
                    type="button"
                    className="rounded border border-slate-300 px-2 py-1 text-sm"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                >
                    箇条書き
                </button>
                <button
                    type="button"
                    className="rounded border border-slate-300 px-2 py-1 text-sm"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                >
                    番号付き
                </button>

                <div className="ml-auto flex items-center gap-2">
                    <button
                        type="button"
                        className={`rounded border px-2 py-1 text-sm ${previewMode === 'editor' ? 'border-slate-600' : 'border-slate-300'
                            }`}
                        onClick={() => setPreviewMode('editor')}
                    >
                        編集
                    </button>
                    <button
                        type="button"
                        className={`rounded border px-2 py-1 text-sm ${previewMode === 'html' ? 'border-slate-600' : 'border-slate-300'
                            }`}
                        onClick={() => setPreviewMode('html')}
                    >
                        プレビュー
                    </button>
                </div>
            </div>

            {/* Body */}
            {previewMode === 'editor' ? (
                <EditorContent editor={editor} />
            ) : (
                <div className="rounded border border-slate-300 p-3">
                    <div className="text-xs text-slate-500 mb-2">
                        プレビュー（サニタイズ済み）
                    </div>
                    <div
                        className="mail-preview"
                        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                    />
                </div>
            )}

            {/* Footer actions */}
            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white"
                    onClick={handleSave}
                >
                    保存（JSON+HTML）
                </button>

                <button
                    type="button"
                    className="rounded border border-slate-300 px-3 py-1.5 text-sm"
                    onClick={handleCopyJson}
                >
                    JSONコピー
                </button>

                <button
                    type="button"
                    className="rounded border border-slate-300 px-3 py-1.5 text-sm"
                    onClick={handlePasteJson}
                >
                    JSON貼り付け復元
                </button>

                {lastSaved && (
                    <span className="text-xs text-slate-500 ml-auto">
                        last saved: {lastSaved}
                    </span>
                )}
            </div>

            {/* Image URL dialog */}
            {imageDialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
                    <div className="w-full max-w-lg rounded bg-white p-4 shadow">
                        <div className="mb-2 text-base font-semibold">画像URLを挿入</div>

                        <label className="block text-sm">
                            画像URL（必須）
                            <input
                                className="mt-1 w-full rounded border border-slate-300 p-2"
                                value={imageUrl}
                                onChange={(e) => setImageUrl(e.target.value)}
                                placeholder="https://example.com/image.png"
                            />
                        </label>

                        <label className="block text-sm mt-3">
                            代替テキスト（任意）
                            <input
                                className="mt-1 w-full rounded border border-slate-300 p-2"
                                value={imageAlt}
                                onChange={(e) => setImageAlt(e.target.value)}
                                placeholder="例：会場地図"
                            />
                        </label>

                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                type="button"
                                className="rounded border border-slate-300 px-3 py-1.5 text-sm"
                                onClick={() => setImageDialogOpen(false)}
                            >
                                キャンセル
                            </button>
                            <button
                                type="button"
                                className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white"
                                onClick={handleInsertImage}
                            >
                                挿入
                            </button>
                        </div>

                        <div className="mt-3 text-xs text-slate-500">
                            注：メールでは外部画像が既定でブロックされる場合があります。本文が画像依存にならないようにしてください。
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
