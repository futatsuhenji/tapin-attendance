// SPDX-FileCopyrightText: 2026 KATO Hayate <dev@hayatek.jp>
// SPDX-License-Identifier: AGPL-3.0-only

'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';

import { honoClient } from '@/lib/hono';

type UserProfile = {
    id: string;
    email: string;
    name: string;
};

type FetchState = 'idle' | 'loading' | 'error';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function SettingsPage() {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [fetchState, setFetchState] = useState<FetchState>('loading');

    const [nameInput, setNameInput] = useState('');
    const [saveState, setSaveState] = useState<SaveState>('idle');
    const [error, setError] = useState('');

    const load = async () => {
        setFetchState('loading');
        setError('');
        try {
            const response = await honoClient.api.me.$get();
            if (!response.ok) {
                setFetchState('error');
                return;
            }
            const body = await response.json() as { user: UserProfile };
            setUser(body.user);
            setNameInput(body.user.name);
            setFetchState('idle');
        } catch (e) {
            console.error(e);
            setFetchState('error');
        }
    };

    useEffect(() => {
        void load();
    }, []);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!nameInput.trim()) {
            setError('名前を入力してください');
            return;
        }
        setSaveState('saving');
        setError('');
        try {
            const response = await honoClient.api.me.$patch({ json: { name: nameInput.trim() } });
            if (!response.ok) {
                const body = await response.json().catch(() => null) as { message?: string } | null;
                setError(body?.message ?? '更新に失敗しました');
                setSaveState('error');
                return;
            }
            const body = await response.json() as { user: UserProfile };
            setUser(body.user);
            setNameInput(body.user.name);
            setSaveState('saved');
        } catch (e) {
            console.error(e);
            setError('更新に失敗しました');
            setSaveState('error');
        } finally {
            setTimeout(() => setSaveState('idle'), 1200);
        }
    };

    if (fetchState === 'loading') {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-700">読込中…</div>;
    }

    if (fetchState === 'error' || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-700">
                <div className="text-center space-y-3">
                    <p>設定を読み込めませんでした。ログイン状態を確認してください。</p>
                    <div className="flex justify-center gap-2">
                        <Link
                            href="/login"
                            className={[
                                'rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm',
                                'hover:bg-blue-700',
                            ].join(' ')}
                        >
                            ログインページへ
                        </Link>
                        <button
                            type="button"
                            onClick={() => void load()}
                            className={[
                                'rounded-md border border-gray-200 bg-white px-4 py-2 text-sm',
                                'font-semibold text-gray-700 shadow-sm',
                                'hover:border-gray-300',
                            ].join(' ')}
                        >
                            再読み込み
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-3xl px-4 py-10 space-y-6">
                <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-sm text-gray-500">設定</p>
                        <h1 className="text-3xl font-semibold text-gray-900">アカウント情報</h1>
                        <p className="text-sm text-gray-600">ログイン中のアカウント名を変更できます。</p>
                    </div>
                    <Link
                        href="/mypage"
                        className={[
                            'inline-flex items-center justify-center rounded-md border border-gray-200',
                            'bg-white px-4 py-2',
                            'text-sm font-semibold text-gray-700 shadow-sm hover:border-gray-300',
                        ].join(' ')}
                    >
                        マイページに戻る
                    </Link>
                </header>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">メールアドレス</label>
                            <input
                                type="email"
                                value={user.email}
                                readOnly
                                className={[
                                    'mt-1 w-full cursor-not-allowed rounded-md border border-gray-200',
                                    'bg-gray-50 px-3 py-2',
                                    'text-gray-700 shadow-sm',
                                ].join(' ')}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">表示名</label>
                            <input
                                type="text"
                                value={nameInput}
                                onChange={(event) => setNameInput(event.target.value)}
                                className={[
                                    'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm',
                                    'focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
                                ].join(' ')}
                                placeholder="例: 山田 太郎"
                            />
                            <p className="mt-1 text-xs text-gray-500">参加者一覧やメールに表示される名前です。</p>
                        </div>
                        {error && <p className="text-sm text-red-600">{error}</p>}
                        {saveState === 'saved' && !error && <p className="text-sm text-emerald-600">保存しました</p>}
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={saveState === 'saving'}
                                className={[
                                    'inline-flex items-center justify-center rounded-md bg-blue-600 px-5 py-2 text-sm',
                                    'font-semibold text-white shadow-sm transition',
                                    'hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60',
                                ].join(' ')}
                            >
                                {saveState === 'saving' ? '保存中…' : '変更を保存'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
