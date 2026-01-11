'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

import { honoClient } from '@/lib/hono';

type SaveState = 'idle' | 'saving' | 'error';

type Properties = {
    ownerId: string | null;
};

export default function GroupCreateForm({ ownerId }: Properties) {
    const router = useRouter();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [saveState, setSaveState] = useState<SaveState>('idle');

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!ownerId) return;
        if (!name.trim()) return;

        setSaveState('saving');
        try {
            const response = await honoClient.api.groups.$post({
                json: {
                    name: name.trim(),
                    ownerId,
                    description: description.trim() || undefined,
                },
            });

            if (!response.ok) {
                setSaveState('error');
                return;
            }

            const created = (await response.json()) as { id: string };
            router.push(`/group/${created.id}/manage`);
        } catch (e) {
            console.error(e);
            setSaveState('error');
        } finally {
            setTimeout(() => setSaveState('idle'), 1200);
        }
    };

    if (!ownerId) {
        return (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                ログインしてからグループを作成してください。
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700">グループ名</label>
                <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="例: サークルA"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">概要 (任意)</label>
                <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="グループの紹介や目的"
                />
            </div>
            <button
                type="submit"
                disabled={saveState === 'saving'}
                className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
                {saveState === 'saving' ? '作成中…' : '作成する'}
            </button>
            {saveState === 'error' && <p className="text-sm text-red-600">グループの作成に失敗しました</p>}
        </form>
    );
}
