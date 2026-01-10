'use client';

import React, { useEffect, useRef } from 'react';

type Props = {
    open: boolean;
    title?: string;

    linkUrl: string;
    setLinkUrl: (v: string) => void;

    onCancel: () => void;
    onConfirm: (linkUrl: string) => void;

    helperText?: string;
};

export default function linkDialog({
    open,
    title = 'リンクを設定',
    linkUrl,
    setLinkUrl,
    onCancel,
    onConfirm,
    helperText = '',
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
                    URL
                    <input
                        ref={urlRef}
                        className="mt-1 w-full rounded border border-slate-300 p-2"
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        placeholder="https://example.com"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') onConfirm(linkUrl);
                            if (e.key === 'Escape') onCancel();
                        }}
                    />
                </label>

                <div className="mt-4 flex justify-end gap-2">
                    <button
                        type="button"
                        className={`
                            inline-flex items-center justify-center
                            rounded-md px-6 py-2
                            text-base font-medium
                            hover:bg-slate-200
                            disabled:opacity-50
                        `}
                        onClick={onCancel}
                    >
                        キャンセル
                    </button>
                    <button
                        type="button"
                        className={`
                            inline-flex items-center justify-center
                            rounded-md px-6 py-2
                            text-base font-medium text-blue-600
                            hover:bg-blue-100
                            disabled:opacity-50
                        `}
                        onClick={() => onConfirm(linkUrl)}
                    >
                        挿入
                    </button>
                </div>

                <div className="mt-3 text-xs text-slate-500">{helperText}</div>
            </div>
        </div>
    );
}
