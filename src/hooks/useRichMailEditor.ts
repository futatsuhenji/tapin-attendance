'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import DOMPurify from 'isomorphic-dompurify';
import { useEditor, JSONContent } from '@tiptap/react';
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

                if (isComposing) return false;
                return this.editor.commands.setHardBreak();
            },
            'Shift-Enter': () => this.editor.commands.splitBlock(),
        };
    },
});

function isSafeHttpUrl(url: string): boolean {
    try {
        const u = new URL(url);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
        const path = u.pathname.toLowerCase();
        return /\.(png|jpe?g|webp|gif|svg)$/.test(path);
    } catch {
        return false;
    }
}

export function useRichMailEditor(initialJson?: JSONContent | null) {
    const [currentColor, setCurrentColor] = useState('#000000');
    const [blockType, setBlockType] = useState<'p' | 'h1' | 'h2' | 'h3'>('p');
    const [editorTick, setEditorTick] = useState(0);

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
                hardBreak: false,
            }),
            HardBreak.configure({ keepMarks: true }),
            EnterAsHardBreak,
            Link.configure({
                openOnClick: false,
                autolink: true,
                linkOnPaste: true,
            }),
            Image.configure({ inline: false, allowBase64: false }),
            HorizontalRule,
            TextStyle,
            Color,
        ],
        content:
            initialJson ?? ({
                type: 'doc',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }],
            } as JSONContent),
        editorProps: {
            attributes: {
                class: 'tiptap min-h-[260px] rounded border border-slate-300 p-3 focus:outline-none',
            },
        },
    });

    const rawHtml = editor?.getHTML() ?? '';
    const sanitizedHtml = useMemo(() => {
        return DOMPurify.sanitize(rawHtml, {
            ALLOWED_TAGS: [
                'p', 'br', 'strong', 'em', 'u', 'a', 'img', 'hr',
                'ul', 'ol', 'li', 'span', 'h1', 'h2', 'h3',
            ],
            ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'style'],
        });
    }, [rawHtml]);

    // blockType 同期
    useEffect(() => {
        if (!editor) return;

        const sync = () => {
            if (editor.isActive('heading', { level: 1 })) setBlockType('h1');
            else if (editor.isActive('heading', { level: 2 })) setBlockType('h2');
            else if (editor.isActive('heading', { level: 3 })) setBlockType('h3');
            else setBlockType('p');
        };

        sync();
        editor.on('selectionUpdate', sync);
        editor.on('transaction', sync);
        return () => {
            editor.off('selectionUpdate', sync);
            editor.off('transaction', sync);
        };
    }, [editor]);

    // color 同期
    useEffect(() => {
        if (!editor) return;

        const sync = () => {
            const c = editor.getAttributes('textStyle')?.color;
            setCurrentColor(c && typeof c === 'string' ? c : '#000000');
        };

        sync();
        editor.on('selectionUpdate', sync);
        editor.on('transaction', sync);
        return () => {
            editor.off('selectionUpdate', sync);
            editor.off('transaction', sync);
        };
    }, [editor]);

    useEffect(() => {
        if (!editor) return;

        const bump = () => setEditorTick((x) => x + 1);

        editor.on('transaction', bump);
        editor.on('selectionUpdate', bump);

        return () => {
            editor.off('transaction', bump);
            editor.off('selectionUpdate', bump);
        };
    }, [editor]);


    const insertImage = useCallback(
        (url: string, alt?: string) => {
            if (!editor) return { ok: false as const, reason: 'no-editor' as const };
            const u = url.trim();
            if (!isSafeHttpUrl(u)) return { ok: false as const, reason: 'invalid-url' as const };

            editor.chain().focus().setImage({ src: u, alt: alt?.trim() || undefined }).run();
            return { ok: true as const };
        },
        [editor]
    );

    const toggleLink = useCallback(() => {
        if (!editor) return;
        const previousUrl = editor.getAttributes('link').href as string | undefined;
        const url = globalThis.prompt('リンクURLを入力してください', previousUrl ?? 'https://');
        if (url === null) return;

        const trimmed = url.trim();
        if (trimmed === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }
        if (!isSafeHttpUrl(trimmed)) {
            alert('リンクURLが不正です（http/https のURLを入力してください）');
            return;
        }
        editor.chain().focus().extendMarkRange('link').setLink({
            href: trimmed,
            target: '_blank',
            rel: 'noopener noreferrer',
        }).run();
    }, [editor]);

    const copyJson = useCallback(async () => {
        if (!editor) return;
        await navigator.clipboard.writeText(JSON.stringify(editor.getJSON(), null, 2));
        alert('JSONをクリップボードにコピーしました');
    }, [editor]);

    const pasteJson = useCallback(() => {
        if (!editor) return;
        const jsonString = globalThis.prompt('貼り付けるTiptap JSONを入力してください（全体を貼り付け）');
        if (!jsonString) return;
        try {
            editor.commands.setContent(JSON.parse(jsonString) as JSONContent);
            alert('JSONから復元しました');
        } catch {
            alert('JSONの形式が不正です');
        }
    }, [editor]);

    return {
        editor,
        sanitizedHtml,
        currentColor,
        setCurrentColor,
        blockType,
        setBlockType,
        actions: { insertImage, toggleLink, copyJson, pasteJson },
        editorTick,
    };
}
