'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

type AttendanceStatus = 'PRESENCE' | 'PRESENCE_PARTIALLY' | 'ABSENCE' | 'UNANSWERED';

type EventSummary = {
    name: string;
    description?: string;
    place: string;
    mapUrl?: string;
    startsAt: string;
    endsAt: string;
    registrationEndsAt: string;
};

type AttendanceSummary = {
    total: number;
    presence: number;
    partial: number;
    absence: number;
    unanswered: number;
};

type Attendee = {
    id: string;
    name: string;
    email: string;
    status: AttendanceStatus;
    comment?: string;
    updatedAt: string;
};

type ManageData = {
    event: EventSummary;
    invitation: {
        hasMail: boolean;
        sentAt?: string;
    };
    attendance: AttendanceSummary;
    attendees: Attendee[];
};

type FetchState = 'idle' | 'loading' | 'error';

function formatDateTime(value: string): string {
    const date = new Date(value);
    return new Intl.DateTimeFormat('ja-JP', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

function badgeColor(status: AttendanceStatus): string {
    switch (status) {
        case 'PRESENCE': {
            return 'bg-green-100 text-green-800 border-green-200';
        }
        case 'PRESENCE_PARTIALLY': {
            return 'bg-amber-100 text-amber-800 border-amber-200';
        }
        case 'ABSENCE': {
            return 'bg-red-100 text-red-800 border-red-200';
        }
        // eslint-disable-next-line unicorn/no-useless-switch-case
        case 'UNANSWERED':
        default: {
            return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    }
}

export default function EventManagePage() {
    const { groupId, eventId } = useParams<{ groupId: string; eventId: string }>();

    const [fetchState, setFetchState] = useState<FetchState>('loading');
    const [data, setData] = useState<ManageData | null>(null);

    const registrationClosed = useMemo(() => {
        if (!data) return false;
        return new Date(data.event.registrationEndsAt) < new Date();
    }, [data]);

    const reload = () => {
        setFetchState('loading');
        // Mock fetch with a tiny delay
        setTimeout(() => {
            const now = new Date();
            const startsAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 3);
            const endsAt = new Date(startsAt.getTime() + 1000 * 60 * 60 * 3);
            const registrationEndsAt = new Date(startsAt.getTime() - 1000 * 60 * 60 * 12);

            const attendees: Attendee[] = [
                { id: 'u1', name: '山田 太郎', email: 'taro@example.com', status: 'PRESENCE', comment: '開始10分前に到着予定', updatedAt: now.toISOString() },
                { id: 'u2', name: '佐藤 花子', email: 'hanako@example.com', status: 'PRESENCE_PARTIALLY', comment: '途中で抜けます', updatedAt: now.toISOString() },
                { id: 'u3', name: '鈴木 次郎', email: 'jiro@example.com', status: 'ABSENCE', comment: '出張のため欠席', updatedAt: now.toISOString() },
                { id: 'u4', name: '田中 三郎', email: 'saburo@example.com', status: 'UNANSWERED', updatedAt: now.toISOString() },
            ];

            const summary: AttendanceSummary = {
                total: attendees.length,
                presence: attendees.filter((a) => a.status === 'PRESENCE').length,
                partial: attendees.filter((a) => a.status === 'PRESENCE_PARTIALLY').length,
                absence: attendees.filter((a) => a.status === 'ABSENCE').length,
                unanswered: attendees.filter((a) => a.status === 'UNANSWERED').length,
            };

            setData({
                event: {
                    name: 'イベント管理ダッシュボード（モック）',
                    description: 'ここにイベントの概要が入ります。実APIができたら置き換えてください。',
                    place: '会場A（第1会議室）',
                    mapUrl: 'https://maps.example.com/mock',
                    startsAt: startsAt.toISOString(),
                    endsAt: endsAt.toISOString(),
                    registrationEndsAt: registrationEndsAt.toISOString(),
                },
                invitation: {
                    hasMail: true,
                    sentAt: new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString(),
                },
                attendance: summary,
                attendees,
            });
            setFetchState('idle');
        }, 300);
    };

    useEffect(() => {
        reload();

    }, []);

    if (fetchState === 'loading' || !data) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-600">
                ローディング中…
            </div>
        );
    }

    if (fetchState === 'error') {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-600">
                データ取得に失敗しました（モック）。
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-6xl px-4 py-10">
            <header className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                    <p className="text-sm text-gray-500">管理ダッシュボード（モック）</p>
                    <h1 className="text-3xl font-semibold text-gray-900">{data.event.name}</h1>
                    <p className="text-sm text-gray-500">groupId: {groupId} / eventId: {eventId}</p>
                    {data.event.description && (
                        <p className="mt-2 text-gray-700 whitespace-pre-wrap">{data.event.description}</p>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        onClick={reload}
                        className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:border-gray-300"
                    >
                        モックを再読み込み
                    </button>
                    <Link
                        href={`/event/${groupId}/${eventId}/manage/invitation`}
                        className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
                    >
                        招待メール設定へ
                    </Link>
                </div>
            </header>

            <section className="grid gap-4 md:grid-cols-3 mb-6">
                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <p className="text-sm text-gray-500">回答期限</p>
                    <p className="mt-1 text-lg font-semibold text-gray-900">{formatDateTime(data.event.registrationEndsAt)}</p>
                    <p className={`mt-1 text-sm ${registrationClosed ? 'text-red-600' : 'text-emerald-600'}`}>
                        {registrationClosed ? '締切を過ぎています' : '回答受付中'}
                    </p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <p className="text-sm text-gray-500">招待メール</p>
                    {data.invitation.hasMail ? (
                        <>
                            <p className="mt-1 text-lg font-semibold text-gray-900">作成済み</p>
                            <p className="text-sm text-gray-600">最終送信: {data.invitation.sentAt ? formatDateTime(data.invitation.sentAt) : '未送信'}</p>
                        </>
                    ) : (
                        <p className="mt-1 text-lg font-semibold text-gray-900">未作成</p>
                    )}
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <p className="text-sm text-gray-500">会場</p>
                    <p className="mt-1 text-lg font-semibold text-gray-900">{data.event.place}</p>
                    {data.event.mapUrl && (
                        <a className="text-sm text-blue-600 hover:underline" href={data.event.mapUrl} target="_blank" rel="noreferrer">地図を開く</a>
                    )}
                </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 mb-6">
                <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-gray-900">スケジュール</h2>
                    </div>
                    <dl className="mt-3 space-y-2 text-gray-800">
                        <div>
                            <dt className="text-sm text-gray-500">開始</dt>
                            <dd className="text-base">{formatDateTime(data.event.startsAt)}</dd>
                        </div>
                        <div>
                            <dt className="text-sm text-gray-500">終了</dt>
                            <dd className="text-base">{formatDateTime(data.event.endsAt)}</dd>
                        </div>
                    </dl>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-gray-900">出欠サマリ</h2>
                        <span className="text-sm text-gray-500">合計 {data.attendance.total} 名</span>
                    </div>
                    <div className="mt-4 space-y-2">
                        <SummaryRow label="出席" value={data.attendance.presence} total={data.attendance.total} color="bg-green-500" />
                        <SummaryRow label="遅刻・早退" value={data.attendance.partial} total={data.attendance.total} color="bg-amber-500" />
                        <SummaryRow label="欠席" value={data.attendance.absence} total={data.attendance.total} color="bg-red-500" />
                        <SummaryRow label="未回答" value={data.attendance.unanswered} total={data.attendance.total} color="bg-gray-400" />
                    </div>
                </div>
            </section>

            <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">参加者リスト（モック）</h2>
                    <p className="text-sm text-gray-500">ダブルクリックで詳細表示（将来の実装想定）</p>
                </div>
                <div className="mt-4 overflow-hidden rounded-md border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left font-medium text-gray-700">名前</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-700">メール</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-700">ステータス</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-700">コメント</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-700">更新</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {data.attendees.map((attendee) => (
                                <tr key={attendee.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 font-medium text-gray-900">{attendee.name}</td>
                                    <td className="px-4 py-2 text-gray-700">{attendee.email}</td>
                                    <td className="px-4 py-2">
                                        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${badgeColor(attendee.status)}`}>
                                            {statusLabel(attendee.status)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2 text-gray-700">{attendee.comment ?? '—'}</td>
                                    <td className="px-4 py-2 text-gray-600">{formatDateTime(attendee.updatedAt)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}

function SummaryRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
    const ratio = total > 0 ? Math.round((value / total) * 100) : 0;
    return (
        <div>
            <div className="flex items-center justify-between text-sm text-gray-700">
                <span>{label}</span>
                <span className="font-semibold">{value} 名</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-gray-100">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${ratio}%` }} />
            </div>
        </div>
    );
}

function statusLabel(status: AttendanceStatus): string {
    switch (status) {
        case 'PRESENCE': {
            return '出席';
        }
        case 'PRESENCE_PARTIALLY': {
            return '遅刻・早退';
        }
        case 'ABSENCE': {
            return '欠席';
        }
        // eslint-disable-next-line unicorn/no-useless-switch-case
        case 'UNANSWERED':
        default: {
            return '未回答';
        }
    }
}
