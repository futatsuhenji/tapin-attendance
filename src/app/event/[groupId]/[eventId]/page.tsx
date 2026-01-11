'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation'; // useSearchParams を追加

import { honoClient } from '@/lib/hono';


type AttendanceStatus = 'PRESENCE' | 'PRESENCE_PARTIALLY' | 'ABSENCE' | 'UNANSWERED';

type EventPayload = {
    id: string;
    name: string;
    groupName: string;
    description: string | null;
    place?: string | null;
    mapUrl: string | null;
    allowVisitorListSharing: boolean;
    registrationEndsAt: string | null;
    startsAt: string | null;
    endsAt: string | null;
};

type AttendancePayload = {
    status: AttendanceStatus;
    comment: string | null;
    updatedAt: string;
};

type ManageInfo = {
    isManager: boolean;
};


type FetchState = 'idle' | 'loading' | 'error';

const attendanceOptions: Array<{ value: AttendanceStatus; label: string; helper?: string }> = [
    { value: 'PRESENCE', label: '出席' },
    { value: 'PRESENCE_PARTIALLY', label: '遅刻・早退', helper: '一部参加' },
    { value: 'ABSENCE', label: '欠席' },
    { value: 'UNANSWERED', label: '未回答', helper: 'あとで回答する' },
];

function formatDateTime(value: string | null): string {
    if (!value) return '未定';
    const date = new Date(value);
    return new Intl.DateTimeFormat('ja-JP', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

export default function EventParticipantPage() {
    const { groupId, eventId } = useParams<{ groupId: string; eventId: string }>();
    const searchParameters = useSearchParams();
    const token = searchParameters.get('token'); // URLパラメータからトークンを取得

    const [fetchState, setFetchState] = useState<FetchState>('loading');
    const [fetchError, setFetchError] = useState<string | null>(null);

    const [event, setEvent] = useState<EventPayload | null>(null);
    const [attendance, setAttendance] = useState<AttendancePayload | null>(null);
    const [manageInfo, setManageInfo] = useState<ManageInfo>({ isManager: false });

    const [comment, setComment] = useState('');
    const [selection, setSelection] = useState<AttendanceStatus>('UNANSWERED');
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);

    const registrationClosed = useMemo(() => {
        if (!event?.registrationEndsAt) return false;
        return new Date(event.registrationEndsAt) < new Date();
    }, [event?.registrationEndsAt]);

    useEffect(() => {
        const load = async () => {
            if (!groupId || !eventId) return;
            setFetchState('loading');
            setFetchError(null);
            try {
                let data;

                if (token) {
                    // 1. トークンがある場合: 新設したステータス取得APIを使用
                    const res = await fetch(`/api/events/${groupId}/${eventId}/respond/status/${token}`);
                    if (!res.ok) {
                        setFetchState('error');
                        setFetchError('無効な招待リンクです');
                        return;
                    }
                    const json = await res.json();
                    data = {
                        event: {
                            name: json.eventName,
                            groupName: json.groupName,
                            registrationEndsAt: json.registrationEndsAt,
                            // 他の詳細は既存のGETから取得できないため最小限の構成
                            description: null,
                            id: eventId,
                        },
                        attendance: {
                            status: json.status,
                            comment: json.comment,
                            updatedAt: new Date().toISOString(),
                        },
                        manage: { isManager: false },
                    };
                } else {
                    // 2. トークンがない場合: 既存のログインユーザー用APIを使用
                    const response = await honoClient.api.events[':groupId'][':eventId'].$get({
                        param: { groupId, eventId },
                    });

                    if (!response.ok) {
                        setFetchState('error');
                        setFetchError('イベント情報の取得に失敗しました');
                        return;
                    }
                    data = await response.json() as {
                        event: EventPayload;
                        attendance: AttendancePayload | null;
                        manage: ManageInfo;
                    };
                }

                setEvent(data.event as EventPayload);
                setAttendance(data.attendance);
                setManageInfo(data.manage ?? { isManager: false });
                setSelection(data.attendance?.status ?? 'UNANSWERED');
                setComment(data.attendance?.comment ?? '');
                setFetchState('idle');
            } catch (e) {
                console.error(e);
                setFetchState('error');
                setFetchError('イベント情報の取得に失敗しました');
            }
        };
        load();
    }, [eventId, groupId, token]);

    const handleSave = async () => {
        if (!groupId || !eventId) return;
        setIsSaving(true);
        setSaveMessage(null);
        try {
            if (token) {
                // 1. トークンがある場合: PATCH API で上書き保存
                const response = await fetch(`/api/events/${groupId}/${eventId}/respond/status/${token}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: selection, comment }),
                });

                if (!response.ok) {
                    const error = await response.json();
                    setSaveMessage(error.message || '更新に失敗しました');
                    return;
                }
                setSaveMessage('出欠を保存し、完了メールを送信しました');
            } else {
                // 2. トークンがない場合: 既存の POST API を使用
                const response = await honoClient.api.events[':groupId'][':eventId'].attendance.$post({
                    param: { groupId, eventId },
                    json: { status: selection, comment },
                });

                if (!response.ok) {
                    setSaveMessage('更新に失敗しました');
                    return;
                }

                const payload = await response.json() as { attendance: AttendancePayload };
                setAttendance(payload.attendance);
                setSelection(payload.attendance.status);
                setComment(payload.attendance.comment ?? '');
                setSaveMessage('出欠を保存しました');
            }
        } catch (e) {
            console.error(e);
            setSaveMessage('更新に失敗しました');
        } finally {
            setIsSaving(false);
        }
    };

    if (fetchState === 'loading') {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-700">
                読み込み中です...
            </div>
        );
    }

    if (fetchState === 'error' || !event) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-700">
                {fetchError ?? 'データを取得できませんでした'}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-5xl px-4 py-10">
                <header className="mb-8">
                    <p className="text-sm text-gray-500">{event.groupName}</p>
                    <div className="flex flex-wrap items-center gap-3 justify-between">
                        <h1 className="mt-2 text-3xl font-semibold text-gray-900">{event.name}</h1>
                        {manageInfo.isManager && (
                            <Link
                                href={`/event/${groupId}/${eventId}/manage`}
                                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:border-gray-300"
                            >
                                管理ダッシュボードへ
                            </Link>
                        )}
                    </div>
                    {event.description && (
                        <p className="mt-2 text-gray-700 whitespace-pre-wrap">{event.description}</p>
                    )}
                </header>

                <section className="grid gap-4 md:grid-cols-2 mb-8">
                    <div className="rounded-lg bg-white p-4 shadow-sm border border-gray-100">
                        <p className="text-sm text-gray-500">日時</p>
                        <p className="mt-1 text-lg text-gray-900">{formatDateTime(event.startsAt)}
                            {event.endsAt ? ` 〜 ${formatDateTime(event.endsAt)}` : ''}</p>
                        {event.registrationEndsAt && (
                            <p className="mt-1 text-sm text-gray-600">回答期限: {formatDateTime(event.registrationEndsAt)}</p>
                        )}
                    </div>
                    <div className="rounded-lg bg-white p-4 shadow-sm border border-gray-100">
                        <p className="text-sm text-gray-500">場所</p>
                        <p className="mt-1 text-lg text-gray-900">{event.place || '未設定'}</p>
                        {event.mapUrl && (
                            <a className="mt-2 inline-flex text-sm text-blue-600 hover:underline" href={event.mapUrl} target="_blank" rel="noreferrer">
                                地図を開く
                            </a>
                        )}
                    </div>
                </section>

                <section className="rounded-lg bg-white p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">出欠を回答する</h2>
                            {registrationClosed && (
                                <p className="text-sm text-red-600 mt-1">回答期限を過ぎています。更新はできません。</p>
                            )}
                        </div>
                        {attendance && (
                            <p className="text-sm text-gray-500">最終更新: {formatDateTime(attendance.updatedAt)}</p>
                        )}
                    </div>

                    <div className="mt-6 grid gap-3 md:grid-cols-2">
                        {attendanceOptions.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => setSelection(option.value)}
                                disabled={registrationClosed || isSaving}
                                className={`w-full rounded-lg border px-4 py-3 text-left transition focus:outline-none ${
                                    selection === option.value
                                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                                        : 'border-gray-200 bg-white text-gray-800 hover:border-gray-300'
                                } ${registrationClosed ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-base font-medium">{option.label}</span>
                                    <span className={`h-4 w-4 rounded-full border ${selection === option.value ? 'border-blue-600 bg-blue-600' : 'border-gray-300 bg-white'}`}></span>
                                </div>
                                {option.helper && <p className="text-sm text-gray-500 mt-1">{option.helper}</p>}
                            </button>
                        ))}
                    </div>

                    <div className="mt-6">
                        <label className="block text-sm font-medium text-gray-700">補足・コメント (任意)</label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            rows={4}
                            disabled={registrationClosed || isSaving}
                            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 text-gray-900 disabled:text-gray-500 placeholder-gray-400"
                            placeholder="例: 仕事の都合で30分ほど遅れます"
                        />
                    </div>

                    <div className="mt-6 flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={registrationClosed || isSaving}
                            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-5 py-2 text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isSaving ? '保存中...' : '保存する'}
                        </button>
                        {saveMessage && <span className="text-sm text-gray-700">{saveMessage}</span>}
                    </div>
                </section>
            </div>
        </div>
    );
}