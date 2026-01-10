'use client';

import React, { useEffect, useRef } from 'react';

type Props = {
    open: boolean;
    title?: string;

    imageUrl: string;
    setImageUrl: (v: string) => void;

    imageAlt: string;
    setImageAlt: (v: string) => void;

    onCancel: () => void;
    onConfirm: () => void;

    helperText?: string;
};

export default function ImageUrlDialog({
    open,
    title = '画像URLを挿入',
    imageUrl,
    setImageUrl,
    imageAlt,
    setImageAlt,
    onCancel,
    onConfirm,
    helperText = '注：メールでは外部画像が既定でブロックされる場合があります。本文が画像依存にならないようにしてください。',
}: Props) {
    const urlRef = useRef<HTMLInputElement | null>(null);

    // 開いたらURL入力にフォーカス
    useEffect(() => {
        if (open) {
            // 描画後にフォーカス
            setTimeout(() => urlRef.current?.focus(), 0);
        }
    }, [open]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
            onMouseDown={(e) => {
                // 背景クリックで閉じたい場合はここを有効化
                if (e.target === e.currentTarget) onCancel();
            }}
        >
            <div className="w-full max-w-lg rounded bg-white p-4 shadow">
                <div className="mb-2 text-base font-semibold">{title}</div>

                <label className="block text-sm">
                    画像URL（必須）
                    <input
                        ref={urlRef}
                        className="mt-1 w-full rounded border border-slate-300 p-2"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        placeholder="https://example.com/image.png"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') onConfirm();
                            if (e.key === 'Escape') onCancel();
                        }}
                    />
                </label>

                <label className="block text-sm mt-3">
                    代替テキスト（任意）
                    <input
                        className="mt-1 w-full rounded border border-slate-300 p-2"
                        value={imageAlt}
                        onChange={(e) => setImageAlt(e.target.value)}
                        placeholder="例：会場地図"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') onConfirm();
                            if (e.key === 'Escape') onCancel();
                        }}
                    />
                </label>

                <div className="mt-4 flex justify-end gap-2">
                    <button
                        type="button"
                        className="rounded border border-slate-300 px-3 py-1.5 text-sm"
                        onClick={onCancel}
                    >
                        キャンセル
                    </button>
                    <button
                        type="button"
                        className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white"
                        onClick={onConfirm}
                    >
                        挿入
                    </button>
                </div>

                <div className="mt-3 text-xs text-slate-500">{helperText}</div>
            </div>
        </div>
    );
}
