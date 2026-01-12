// SPDX-FileCopyrightText: 2026 KATO Hayate <dev@hayatek.jp>
// SPDX-License-Identifier: AGPL-3.0-only

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { honoClient } from '@/lib/hono';


type Administrator = {
    id: string;
    name: string;
    email: string;
    role: 'owner' | 'admin';
    addedAt: string | null;
};

type FetchState = 'idle' | 'loading' | 'error';

function formatDate(value: string | null): string {
    if (!value) return '作成時に自動付与';
    const date = new Date(value);
    return new Intl.DateTimeFormat('ja-JP', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

export default function AdministratorsPage() {
    const { groupId, eventId } = useParams<{ groupId: string; eventId: string }>();

    const [administrators, setAdministrators] = useState<Administrator[]>([]);
    const [email, setEmail] = useState('');
    const [fetchState, setFetchState] = useState<FetchState>('loading');
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [removingId, setRemovingId] = useState<string | null>(null);
    const busy = useMemo(() => fetchState === 'loading' || removingId !== null, [fetchState, removingId]);

    const loadAdministrators = async () => {
        if (!groupId || !eventId) return;
        setFetchState('loading');
        setError(null);
        try {
            const response = await honoClient.api.events[':groupId'][':eventId'].manage.administrators.$get({
                param: { groupId, eventId },
            });
            if (!response.ok) {
                setFetchState('error');
                setError('管理者リストの取得に失敗しました。');
                return;
            }
            const data = await response.json();
            setAdministrators(data.administrators ?? []);
            setFetchState('idle');
        } catch (e) {
            console.error('Failed to load administrators', e);
            setError('管理者リストの取得に失敗しました。');
            setFetchState('error');
        }
    };

    const addAdministrator = async () => {
        if (!email.trim() || !groupId || !eventId) return;
        setMessage(null);
        setError(null);
        setFetchState('loading');
        try {
            const response = await honoClient.api.events[':groupId'][':eventId'].manage.administrators.$post({
                param: { groupId, eventId },
                json: { email: email.trim() },
            });
            if (response.ok) {
                setEmail('');
                setMessage('管理者を追加しました。');
                await loadAdministrators();
            } else {
                const body = await response.json().catch(() => ({ message: '追加に失敗しました。' }));
                setError(body.message || '追加に失敗しました。');
                setFetchState('idle');
            }
        } catch (e) {
            console.error('Failed to add administrator', e);
            setError('追加に失敗しました。');
            setFetchState('idle');
        }
    };

    const removeAdministrator = async (userId: string) => {
        if (!groupId || !eventId) return;
        setRemovingId(userId);
        setError(null);
        setMessage(null);
        try {
            const response = await honoClient.api.events[':groupId'][':eventId'].manage.administrators.$delete({
                param: { groupId, eventId },
                json: { userId },
            });
            if (response.ok) {
                setMessage('管理者を削除しました。');
                await loadAdministrators();
            } else {
                const body = await response.json().catch(() => ({ message: '削除に失敗しました。' }));
                setError(body.message || '削除に失敗しました。');
            }
        } catch (e) {
            console.error('Failed to remove administrator', e);
            setError('削除に失敗しました。');
        } finally {
            setRemovingId(null);
            setFetchState('idle');
        }
    };

    useEffect(() => {
        loadAdministrators();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupId, eventId]);

    const owner = administrators.find((admin) => admin.role === 'owner');
    const delegates = administrators.filter((admin) => admin.role === 'admin');

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="bg-gradient-to-r from-slate-900 via-indigo-800 to-sky-700 text-white">
                <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-10">
                    <p className="text-sm font-semibold tracking-wide text-sky-100">Admin Console</p>
                    <h1 className="text-3xl font-bold leading-tight">イベント管理者の設定</h1>
                    <p className="max-w-3xl text-slate-100">オーナーに加えて複数の管理者を招待できます。メールアドレスで追加し、必要に応じて権限を整理してください。</p>
                    <div className="mt-2 flex flex-wrap gap-3">
                        <Link
                            href={`/event/${groupId}/${eventId}/manage`}
                            className="inline-flex items-center gap-2 rounded-md bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/30 transition hover:bg-white/20"
                        >
                            ダッシュボードへ戻る
                        </Link>
                        <Link
                            href={`/event/${groupId}/${eventId}`}
                            className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
                        >
                            イベントページを見る
                        </Link>
                    </div>
                </div>
            </div>

            <div className="mx-auto -mt-8 flex max-w-5xl flex-col gap-6 px-6 pb-12">
                <section className="rounded-2xl bg-white p-6 shadow-xl shadow-slate-200/70">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">管理者を招待</h2>
                            <p className="text-sm text-slate-600">メールアドレスを入力すると既存ユーザーを管理者として追加します。</p>
                        </div>
                        <button
                            type="button"
                            onClick={loadAdministrators}
                            disabled={fetchState === 'loading'}
                            className="inline-flex items-center justify-center rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            最新の状態を取得
                        </button>
                    </div>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="user@example.com"
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100"
                            disabled={busy}
                        />
                        <button
                            type="button"
                            onClick={addAdministrator}
                            disabled={busy || !email.trim()}
                            className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap"
                        >
                            {fetchState === 'loading' ? '処理中…' : '管理者に追加'}
                        </button>
                    </div>
                    {message && (
                        <p className="mt-3 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>
                    )}
                    {error && (
                        <p className="mt-3 rounded-md border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
                    )}
                </section>

                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold tracking-wide text-slate-700">現在の管理者</h3>
                        <span className="text-xs text-slate-500">合計 {administrators.length} 名</span>
                    </div>

                    {fetchState === 'loading' && administrators.length === 0 ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                            {Array.from({ length: 2 }).map((_, index) => (
                                <div key={index} className="animate-pulse rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                    <div className="h-4 w-32 rounded bg-slate-200" />
                                    <div className="mt-2 h-3 w-24 rounded bg-slate-100" />
                                    <div className="mt-4 h-8 w-full rounded bg-slate-100" />
                                </div>
                            ))}
                        </div>
                    // eslint-disable-next-line sonarjs/no-nested-conditional
                    ) : (administrators.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-slate-600 shadow-sm">
                            まだ管理者がいません。メールアドレスを入力して追加してください。
                        </div>
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                            {owner && (
                                <AdminCard
                                    key={owner.id}
                                    admin={owner}
                                    onRemove={null}
                                    disabled={busy}
                                />
                            )}
                            {delegates.map((admin) => (
                                <AdminCard
                                    key={admin.id}
                                    admin={admin}
                                    onRemove={() => removeAdministrator(admin.id)}
                                    disabled={busy && removingId !== admin.id}
                                    removing={removingId === admin.id}
                                />
                            ))}
                        </div>
                    ))}
                </section>
            </div>
        </div>
    );
}

function AdminCard({
    admin,
    onRemove,
    disabled,
    removing,
}: {
    admin: Administrator;
    onRemove: (() => void) | null;
    disabled?: boolean;
    removing?: boolean;
}) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white/95 p-5 shadow-sm shadow-slate-200/70">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-base font-semibold text-slate-900">{admin.name}</p>
                    <p className="text-sm text-slate-600">{admin.email}</p>
                </div>
                <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${admin.role === 'owner' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'}`}
                >
                    {admin.role === 'owner' ? 'オーナー' : '管理者'}
                </span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span>追加日: {formatDate(admin.addedAt)}</span>
                {onRemove && (
                    <button
                        type="button"
                        onClick={onRemove}
                        disabled={disabled}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {removing ? '削除中…' : '権限を外す'}
                    </button>
                )}
            </div>
        </div>
    );
}
