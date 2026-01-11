'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { honoClient } from '@/lib/hono';

type EventListItem = {
    id: string;
    name: string;
    description: string | null;
    place: string | null;
    startsAt: string | null;
    endsAt: string | null;
    registrationEndsAt: string | null;
    canManage: boolean;
};

type FetchState = 'idle' | 'loading' | 'error';

function formatDateRange(startsAt: string | null, endsAt: string | null): string {
    if (!startsAt && !endsAt) return '未定';
    // eslint-disable-next-line unicorn/consistent-function-scoping
    const format = (value: string) =>
        new Intl.DateTimeFormat('ja-JP', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(new Date(value));
    if (startsAt && endsAt) return `${format(startsAt)} 〜 ${format(endsAt)}`;
    if (startsAt) return `${format(startsAt)} 開始`;
    return `${format(endsAt!)} 終了`; // endsAtのみ
}

export default function EventListPage() {
    const { groupId } = useParams<{ groupId: string }>();
    const [fetchState, setFetchState] = useState<FetchState>('loading');
    const [events, setEvents] = useState<EventListItem[]>([]);

    useEffect(() => {
        const load = async () => {
            if (!groupId) return;
            setFetchState('loading');
            try {
                const response = await honoClient.api.events[':groupId'].$get({ param: { groupId } });
                if (!response.ok) {
                    setFetchState('error');
                    return;
                }
                const data = await response.json() as { events: EventListItem[] };
                setEvents(data.events);
                setFetchState('idle');
            } catch (e) {
                console.error(e);
                setFetchState('error');
            }
        };
        load();
    }, [groupId]);

    if (fetchState === 'loading') {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-700">読込中…</div>;
    }

    if (fetchState === 'error') {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-700">イベント一覧を取得できませんでした</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">
                <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-sm text-gray-500">イベント一覧</p>
                        <h1 className="text-3xl font-semibold text-gray-900">グループのイベント</h1>
                    </div>
                    <Link
                        href={`/group/${groupId}/manage`}
                        className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:border-gray-300"
                    >
                        グループ管理へ
                    </Link>
                </header>

                {events.length === 0 ? (
                    <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-600">イベントがありません</div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {events.map((event) => (
                            <div key={event.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm flex flex-col gap-3">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h2 className="text-xl font-semibold text-gray-900">{event.name}</h2>
                                        {event.description && (
                                            <p className="mt-1 text-sm text-gray-700 line-clamp-2">{event.description}</p>
                                        )}
                                    </div>
                                    {event.canManage && (
                                        <Link
                                            href={`/event/${groupId}/${event.id}/manage`}
                                            className="text-sm text-blue-600 hover:underline"
                                        >
                                            管理
                                        </Link>
                                    )}
                                </div>
                                <div className="text-sm text-gray-600">
                                    <p>日時: {formatDateRange(event.startsAt, event.endsAt)}</p>
                                    <p>場所: {event.place || '未設定'}</p>
                                    {event.registrationEndsAt && (
                                        <p>回答期限: {formatDateRange(event.registrationEndsAt, null)}</p>
                                    )}
                                </div>
                                <div className="flex gap-3">
                                    <Link
                                        href={`/event/${groupId}/${event.id}`}
                                        className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:border-gray-300"
                                    >
                                        詳細へ
                                    </Link>
                                    {event.canManage && (
                                        <Link
                                            href={`/event/${groupId}/${event.id}/manage`}
                                            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
                                        >
                                            管理ダッシュボード
                                        </Link>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
