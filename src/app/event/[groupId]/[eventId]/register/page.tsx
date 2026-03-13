// SPDX-FileCopyrightText: 2026 KATO Hayate <dev@hayatek.jp>
// SPDX-License-Identifier: AGPL-3.0-only

'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

type SubmitState = 'idle' | 'submitting' | 'done' | 'error';

const statusMessages: Record<string, { tone: 'success' | 'error'; text: string }> = {
    completed: { tone: 'success', text: '本登録が完了しました。イベントの参加者として登録されました。' },
    unauthorized: { tone: 'error', text: '認証情報を確認できませんでした。もう一度メールのリンクから実行してください。' },
    closed: { tone: 'error', text: 'このイベントの受付は終了しています。' },
    'token-invalid': { tone: 'error', text: '登録トークンが無効または期限切れです。再度お申し込みください。' },
    'token-mismatch': { tone: 'error', text: '登録情報の整合性チェックに失敗しました。再度お申し込みください。' },
    'email-mismatch': { tone: 'error', text: '認証したメールアドレスと申込メールアドレスが一致しません。' },
    'event-not-found': { tone: 'error', text: 'イベントが見つかりませんでした。' },
    failed: { tone: 'error', text: '本登録処理に失敗しました。時間をおいて再度お試しください。' },
};

export default function EventRegisterPage() {
    const { groupId, eventId } = useParams<{ groupId: string; eventId: string }>();
    const searchParameters = useSearchParams();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [submitState, setSubmitState] = useState<SubmitState>('idle');
    const [message, setMessage] = useState('');

    const status = searchParameters.get('status');
    const resultMessage = useMemo(() => {
        if (!status) return null;
        return statusMessages[status] ?? { tone: 'error' as const, text: '処理結果を判定できませんでした。' };
    }, [status]);
    const hideForm = resultMessage?.tone === 'success';

    const handleSubmit = async () => {
        if (!groupId || !eventId) return;
        if (!name.trim() || !email.trim()) {
            setSubmitState('error');
            setMessage('名前とメールアドレスを入力してください。');
            return;
        }

        setSubmitState('submitting');
        setMessage('');

        try {
            const requestResponse = await fetch(`/api/events/${groupId}/${eventId}/register/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(),
                    email: email.trim(),
                }),
            });

            if (!requestResponse.ok) {
                const payload = await requestResponse.json().catch(() => null) as { message?: string } | null;
                setSubmitState('error');
                setMessage(payload?.message ?? '確認メール送信の準備に失敗しました。');
                return;
            }

            const requestPayload = await requestResponse.json() as { registrationToken: string };
            const redirectUrl = `/api/events/${groupId}/${eventId}/register/complete?token=${encodeURIComponent(requestPayload.registrationToken)}`;

            const verifyResponse = await fetch('/api/auth/email/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email.trim(),
                    redirectUrl,
                }),
            });

            if (!verifyResponse.ok) {
                const payload = await verifyResponse.json().catch(() => null) as { message?: string } | null;
                setSubmitState('error');
                setMessage(payload?.message ?? '確認メールの送信に失敗しました。');
                return;
            }

            setSubmitState('done');
            setMessage('確認メールを送信しました。メール内URLを開くと本登録が完了します。');
        } catch (e) {
            console.error(e);
            setSubmitState('error');
            setMessage('通信エラーが発生しました。時間をおいて再試行してください。');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 px-4 py-10">
            <div className="mx-auto max-w-xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                <header className="mb-6">
                    <p className="text-sm text-gray-500">イベント参加登録</p>
                    <h1 className="mt-1 text-2xl font-semibold text-gray-900">新規会員登録</h1>
                    <p className="mt-2 text-sm text-gray-600">名前とメールアドレスを入力し、確認メールから本登録を完了してください。</p>
                </header>

                {resultMessage && (
                    <div
                        className={`mb-4 rounded-md border px-4 py-3 text-sm ${
                            resultMessage.tone === 'success'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                : 'border-red-200 bg-red-50 text-red-700'
                        }`}
                    >
                        {resultMessage.text}
                    </div>
                )}

                {!hideForm && (
                    <div className="space-y-4">
                        <label className="block">
                            <span className="block text-sm font-medium text-gray-700">名前</span>
                            <input
                                type="text"
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="例: 山田 太郎"
                            />
                        </label>

                        <label className="block">
                            <span className="block text-sm font-medium text-gray-700">メールアドレス</span>
                            <input
                                type="email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="example@example.com"
                            />
                        </label>

                        {message && (
                            <p className={`text-sm ${submitState === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>
                                {message}
                            </p>
                        )}

                        <div className="flex flex-wrap items-center gap-3 pt-2">
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={submitState === 'submitting'}
                                className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {submitState === 'submitting' ? '送信中…' : '登録する'}
                            </button>
                            <Link
                                href={`/event/${groupId}/${eventId}`}
                                className="inline-flex items-center rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:border-gray-300"
                            >
                                イベントページへ戻る
                            </Link>
                        </div>
                    </div>
                )}

                {hideForm && (
                    <div className="pt-2">
                        <Link
                            href={`/event/${groupId}/${eventId}`}
                            className="inline-flex items-center rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:border-gray-300"
                        >
                            イベントページへ
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
