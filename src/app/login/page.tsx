// SPDX-FileCopyrightText: 2026 KATO Hayate <dev@hayatek.jp>
// SPDX-License-Identifier: AGPL-3.0-only

'use client';

import { FormEvent, Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function LoginContent() {
    const searchParameters = useSearchParams();
    const redirectUrl = useMemo(
        () => searchParameters.get('redirectUrl') ?? searchParameters.get('redirect') ?? '/mypage',
        [searchParameters],
    );

    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState<string>('');

    const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmedEmail = email.trim();
        if (!trimmedEmail) {
            setStatus('error');
            setMessage('メールアドレスを入力してください。');
            return;
        }
        setStatus('loading');
        setMessage('');
        try {
            const response = await fetch('/api/auth/email/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: trimmedEmail, redirectUrl }),
            });
            if (response.ok) {
                setStatus('success');
                setMessage('認証リンクを送信しました。メールボックスを確認してください。');
            } else {
                const data = await response.json().catch(() => null);
                setStatus('error');
                setMessage(data?.message ?? '送信に失敗しました。時間をおいて再度お試しください。');
            }
        } catch (e) {
            console.error(e);
            setStatus('error');
            setMessage('通信に失敗しました。ネットワーク環境をご確認ください。');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-3xl px-4 py-12 space-y-8">
                <header className="space-y-2">
                    <p className="text-sm text-gray-500">ログイン</p>
                    <h1 className="text-3xl font-semibold text-gray-900">メールリンクでログイン</h1>
                    <p className="text-sm text-gray-600">
                        パスワードなしでサインインできます。入力したメールアドレス宛に5分間有効なリンクを送ります。
                    </p>
                </header>

                <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
                    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                        <form className="space-y-4" onSubmit={onSubmit}>
                            <div>
                                <label className="block text-sm font-medium text-gray-700" htmlFor="email">メールアドレス</label>
                                <input
                                    id="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder="you@example.com"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={status === 'loading'}
                                className="inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {status === 'loading' ? '送信中...' : 'ログインリンクを送信'}
                            </button>
                        </form>
                        {message && (
                            <div
                                className={`rounded-md border px-3 py-2 text-sm ${status === 'success' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}
                            >
                                {message}
                            </div>
                        )}
                        <p className="text-xs text-gray-500">
                            メールが届かない場合は迷惑メールフォルダをご確認ください。5分経過後に再送できます。
                        </p>
                    </div>

                    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                        <h2 className="text-base font-semibold text-gray-900">使い方のヒント</h2>
                        <ul className="space-y-2 text-sm text-gray-700 list-disc list-inside">
                            <li>届いたリンクをクリックすると自動でログインします。</li>
                            <li>リンクは5分間有効です。期限切れの場合は再送してください。</li>
                            <li>ログイン後はマイページへ遷移します。</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
            <LoginContent />
        </Suspense>
    );
}
