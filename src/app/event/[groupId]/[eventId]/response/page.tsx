'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

import { honoClient } from '@/lib/hono';

const messages: Record<string, { title: string; detail: string }> = {
    attend: { title: '参加を受け付けました', detail: 'ご回答ありがとうございます。' },
    absence: { title: '不参加を受け付けました', detail: 'ご回答ありがとうございます。' },
};

type EventInfo = {
    groupName: string;
    eventName: string;
    startsAt?: string | null;
    endsAt?: string | null;
    place?: string | null;
};

export default function AttendanceResponsePage() {
    const { groupId, eventId } = useParams<{ groupId: string; eventId: string }>();
    const searchParameters = useSearchParams();
    const decision = searchParameters.get('decision') ?? 'attend';
    const message = messages[decision] ?? messages.attend;

    const [eventInfo, setEventInfo] = useState<EventInfo>({ groupName: '', eventName: '' });
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
                    setEventInfo({
                        groupName: data.groupName ?? '',
                        eventName: data.eventName ?? '',
                        startsAt: data.startsAt,
                        endsAt: data.endsAt,
                        place: data.place,
                    });
                }
            } finally {
                setLoading(false);
            }
        };
        fetchNames();
    }, [groupId, eventId]);

    const eventPageUrl = useMemo(() => {
        if (!groupId || !eventId) return null;
        if (globalThis.window === undefined) return null;
        return `${globalThis.location.origin}/event/${groupId}/${eventId}`;
    }, [eventId, groupId]);

    // eslint-disable-next-line unicorn/consistent-function-scoping
    const formatGoogleDate = (value: string) => new Date(value).toISOString().replaceAll(/[-:]|\.\d{3}/g, '');

    const calendarUrl = useMemo(() => {
        if (decision !== 'attend' || !eventInfo.startsAt) return null;
        const start = formatGoogleDate(eventInfo.startsAt);
        const endValue = eventInfo.endsAt ?? eventInfo.startsAt;
        const end = formatGoogleDate(endValue);
        const parameters = new URLSearchParams({
            action: 'TEMPLATE',
            text: eventInfo.eventName || 'イベント',
            dates: `${start}/${end}`,
        });
        const details = [
            eventInfo.groupName ? `グループ: ${eventInfo.groupName}` : '',
            eventInfo.eventName ? `イベント: ${eventInfo.eventName}` : '',
            eventPageUrl ? `詳細: ${eventPageUrl}` : '',
        ]
            .filter(Boolean)
            .join('\n');
        if (details) parameters.set('details', details);
        if (eventInfo.place) parameters.set('location', eventInfo.place);
        parameters.set('sf', 'true');
        parameters.set('output', 'xml');
        return `https://www.google.com/calendar/render?${parameters.toString()}`;
    }, [decision, eventInfo, eventPageUrl]);

    return (
        <div className="min-h-screen bg-gray-50 px-6 py-12">
            <div className="mx-auto max-w-2xl rounded-lg bg-white p-8 shadow-sm">
                <h1 className="mt-4 text-2xl font-semibold text-gray-900">{message.title}</h1>
                <p className="mt-2 text-gray-700">{message.detail}</p>

                <div className="mt-6 rounded-md bg-blue-50 px-4 py-3 text-blue-800">
                    <p className="text-sm font-semibold">{loading ? '読み込み中…' : eventInfo.groupName || 'グループ名 未取得'}</p>
                    <p className="text-lg font-bold">{loading ? '' : eventInfo.eventName || 'イベント名 未取得'}</p>
                </div>

                {calendarUrl && (
                    <a
                        className="mt-6 inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700"
                        href={calendarUrl}
                        target="_blank"
                        rel="noreferrer"
                    >
                        Google カレンダーに追加
                    </a>
                )}

                <p className="mt-6 text-sm text-gray-500">このページは出欠登録結果を表示しています。</p>
            </div>
        </div>
    );
}
