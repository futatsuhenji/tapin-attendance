'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

import { honoClient } from '@/lib/hono';

const messages: Record<string, { title: string; detail: string }> = {
    attend: { title: '参加を受け付けました', detail: 'ご回答ありがとうございます。' },
    absence: { title: '不参加を受け付けました', detail: 'ご回答ありがとうございます。' },
};

export default function AttendanceResponsePage() {
    const { groupId, eventId } = useParams<{ groupId: string; eventId: string }>();
    const searchParameters = useSearchParams();
    const decision = searchParameters.get('decision') ?? 'attend';
    const message = messages[decision] ?? messages.attend;

    const [groupName, setGroupName] = useState<string>('');
    const [eventName, setEventName] = useState<string>('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchNames = async () => {
            if (!groupId || !eventId) return;
            try {
                const res = await honoClient.api.events[':groupId'][':eventId'].respond.$get({
                    param: { groupId, eventId },
                });
                if (res.ok) {
                    const data = await res.json();
                    setGroupName(data.groupName ?? '');
                    setEventName(data.eventName ?? '');
                }
            } finally {
                setLoading(false);
            }
        };
        fetchNames();
    }, [groupId, eventId]);

    return (
        <div className="min-h-screen bg-gray-50 px-6 py-12">
            <div className="mx-auto max-w-2xl rounded-lg bg-white p-8 shadow-sm">
                <h1 className="mt-4 text-2xl font-semibold text-gray-900">{message.title}</h1>
                <p className="mt-2 text-gray-700">{message.detail}</p>

                <div className="mt-6 rounded-md bg-blue-50 px-4 py-3 text-blue-800">
                    <p className="text-sm font-semibold">{loading ? '読み込み中…' : groupName || 'グループ名 未取得'}</p>
                    <p className="text-lg font-bold">{loading ? '' : eventName || 'イベント名 未取得'}</p>
                </div>

                <p className="mt-6 text-sm text-gray-500">このページは出欠登録結果を表示しています。</p>
            </div>
        </div>
    );
}
