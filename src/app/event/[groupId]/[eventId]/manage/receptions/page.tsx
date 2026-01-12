// SPDX-FileCopyrightText: 2026 KATO Hayate <dev@hayatek.jp>
// SPDX-License-Identifier: AGPL-3.0-only

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { honoClient } from '@/lib/hono';


type AttendanceStatus = 'PRESENCE' | 'PRESENCE_PARTIALLY' | 'ABSENCE' | 'UNANSWERED';

type Attendee = {
    id: string;
    name: string;
    email: string;
    response: AttendanceStatus;
    comment?: string | null;
    updatedAt: string;
    isRecepted: boolean;
    receptionUpdatedAt?: string | null;
    feeAmount: number | null;
    feePaid: number;
};

type ReceptionData = {
    event: {
        name: string;
        place?: string | null;
        startsAt?: string | null;
        endsAt?: string | null;
    };
    reception: {
        total: number;
        checkedIn: number;
        pending: number;
    };
    fee: {
        totalDue: number;
        totalPaid: number;
        remaining: number;
    };
    attendees: Attendee[];
};

type FetchState = 'idle' | 'loading' | 'error';

type CheckFilter = 'all' | 'checked' | 'pending';

type ResponseFilter = 'all' | AttendanceStatus;

function formatDateTime(value?: string | null): string {
    if (!value) return '-';
    const date = new Date(value);
    return new Intl.DateTimeFormat('ja-JP', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

function statusBadge(status: AttendanceStatus): string {
    switch (status) {
        case 'PRESENCE': {
            return 'bg-emerald-100 text-emerald-800';
        }
        case 'PRESENCE_PARTIALLY': {
            return 'bg-amber-100 text-amber-800';
        }
        case 'ABSENCE': {
            return 'bg-rose-100 text-rose-800';
        }
        default: {
            return 'bg-gray-100 text-gray-700';
        }
    }
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
        default: {
            return '未回答';
        }
    }
}

export default function ReceptionManagePage() {
    const { groupId, eventId } = useParams<{ groupId: string; eventId: string }>();

    const [data, setData] = useState<ReceptionData | null>(null);
    const [fetchState, setFetchState] = useState<FetchState>('loading');
    const [fetchError, setFetchError] = useState('');
    const [searchText, setSearchText] = useState('');
    const [checkFilter, setCheckFilter] = useState<CheckFilter>('all');
    const [responseFilter, setResponseFilter] = useState<ResponseFilter>('all');
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [payingId, setPayingId] = useState<string | null>(null);
    const [partialEditingId, setPartialEditingId] = useState<string | null>(null);
    const [partialInputs, setPartialInputs] = useState<Record<string, string>>({});
    const [partialErrors, setPartialErrors] = useState<Record<string, string>>({});
    const [confirming, setConfirming] = useState<{ attendee: Attendee; amount: number; label: string } | null>(null);
    const [actionMessage, setActionMessage] = useState('');

    const load = async () => {
        if (!groupId || !eventId) return;
        setFetchState('loading');
        setFetchError('');
        try {
            const response = await honoClient.api.events[':groupId'][':eventId'].manage.receptions.$get({
                param: { groupId, eventId },
            });

            if (!response.ok) {
                setFetchState('error');
                setFetchError('データの取得に失敗しました');
                return;
            }

            const body = await response.json() as ReceptionData;
            setData(body);
            setFetchState('idle');
        } catch (e) {
            console.error(e);
            setFetchState('error');
            setFetchError('データの取得に失敗しました');
        }
    };

    useEffect(() => {
        void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupId, eventId]);

    const filteredAttendees = useMemo(() => {
        if (!data) return [] as Attendee[];
        const keyword = searchText.trim().toLowerCase();
        return data.attendees.filter((attendee) => {
            const matchesKeyword = keyword.length === 0
                || attendee.name.toLowerCase().includes(keyword)
                || attendee.email.toLowerCase().includes(keyword);
            const matchesCheck = checkFilter === 'all'
                || (checkFilter === 'checked' ? attendee.isRecepted : !attendee.isRecepted);
            const matchesResponse = responseFilter === 'all'
                ? true
                : attendee.response === responseFilter;
            return matchesKeyword && matchesCheck && matchesResponse;
        });
    }, [checkFilter, data, responseFilter, searchText]);

    const updateAttendee = (attendee: Attendee) => {
        setData((previous) => {
            if (!previous) return previous;
            const attendees = previous.attendees.map((item) =>
                item.id === attendee.id ? attendee : item,
            );
            const checkedIn = attendees.filter((item) => item.isRecepted).length;
            const feeTotal = attendees.reduce((sum, item) => sum + (item.feeAmount ?? 0), 0);
            const feePaid = attendees.reduce((sum, item) => sum + (item.feePaid ?? 0), 0);

            return {
                ...previous,
                attendees,
                reception: {
                    total: attendees.length,
                    checkedIn,
                    pending: attendees.length - checkedIn,
                },
                fee: {
                    totalDue: feeTotal,
                    totalPaid: feePaid,
                    remaining: Math.max(feeTotal - feePaid, 0),
                },
            };
        });
    };

    const submitPayment = async (attendee: Attendee, amount: number, message: { success: string }) => {
        if (!groupId || !eventId) return;

        if (attendee.feeAmount === null && amount > 0) {
            setPartialErrors((previous) => ({ ...previous, [attendee.id]: '会費が未設定です' }));
            return;
        }
        if (amount < 0) {
            setPartialErrors((previous) => ({ ...previous, [attendee.id]: '0以上の数値を入力してください' }));
            return;
        }
        if (attendee.feeAmount !== null && amount > attendee.feeAmount) {
            setPartialErrors((previous) => ({ ...previous, [attendee.id]: '設定された会費を超えています' }));
            return;
        }

        setPayingId(attendee.id);
        setActionMessage('');
        setPartialErrors((previous) => ({ ...previous, [attendee.id]: '' }));
        try {
            const response = await honoClient.api.events[':groupId'][':eventId'].manage.receptions.$post({
                param: { groupId, eventId },
                json: {
                    userId: attendee.id,
                    receipted: amount,
                    amount: attendee.feeAmount ?? undefined,
                },
            });

            if (!response.ok) {
                const body = await response.json().catch(() => null) as { message?: string } | null;
                setActionMessage(body?.message ?? '会費の更新に失敗しました');
                return;
            }

            const payload = await response.json() as { attendee: Attendee };
            updateAttendee(payload.attendee);
            setActionMessage(message.success);
            setPartialEditingId(null);
            setConfirming(null);
        } catch (e) {
            console.error(e);
            setActionMessage('会費の更新に失敗しました');
        } finally {
            setPayingId(null);
            setTimeout(() => setActionMessage(''), 1600);
        }
    };

    const toggleReception = async (attendeeId: string, next: boolean) => {
        if (!groupId || !eventId) return;
        setUpdatingId(attendeeId);
        setActionMessage('');
        try {
            const response = await honoClient.api.events[':groupId'][':eventId'].manage.receptions.$post({
                param: { groupId, eventId },
                json: { userId: attendeeId, isRecepted: next },
            });

            if (!response.ok) {
                const body = await response.json().catch(() => null) as { message?: string } | null;
                setActionMessage(body?.message ?? '更新に失敗しました');
                return;
            }

            const payload = await response.json() as { attendee: Attendee };

            updateAttendee({ ...payload.attendee });
            setActionMessage(next ? '受付済みにしました' : '受付を取り消しました');
        } catch (e) {
            console.error(e);
            setActionMessage('更新に失敗しました');
        } finally {
            setUpdatingId(null);
            setTimeout(() => setActionMessage(''), 1600);
        }
    };

    const handleFullPayment = (attendee: Attendee) => {
        if (attendee.feeAmount === null) {
            setActionMessage('会費が未設定のため徴収できません');
            return;
        }
        setConfirming({ attendee, amount: attendee.feeAmount, label: '全額徴収' });
    };

    if (fetchState === 'loading') {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-700">
                読み込み中です…
            </div>
        );
    }

    if (fetchState === 'error' || !data) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-700">
                {fetchError || 'データを取得できませんでした'}
            </div>
        );
    }

    return (
        <>
            <div className="mx-auto max-w-6xl px-4 py-8">
                <header className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-sm text-gray-500">当日出欠管理</p>
                        <h1 className="text-2xl font-semibold text-gray-900">{data.event.name}</h1>
                        <p className="text-sm text-gray-600">会場: {data.event.place || '未設定'}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <Link
                            href={`/event/${groupId}/${eventId}`}
                            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:border-gray-300"
                        >
                            イベントページへ
                        </Link>
                        <Link
                            href={`/event/${groupId}/${eventId}/manage`}
                            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:border-gray-300"
                        >
                            ダッシュボードへ戻る
                        </Link>
                    </div>
                </header>

                <section className="grid gap-4 sm:grid-cols-3">
                    <StatCard label="登録済み" value={`${data.reception.total} 名`} description="招待済み / 参加予定" tone="default" />
                    <StatCard label="受付済み" value={`${data.reception.checkedIn} 名`} description="当日チェックイン完了" tone="success" />
                    <StatCard label="未受付" value={`${data.reception.pending} 名`} description="まだ来場が確認できていません" tone="warn" />
                </section>

                <section className="mt-4 grid gap-4 sm:grid-cols-3">
                    <StatCard label="会費合計" value={`${data.fee.totalDue.toLocaleString()} 円`} description="設定されている会費の合計" tone="default" />
                    <StatCard label="徴収済み" value={`${data.fee.totalPaid.toLocaleString()} 円`} description="受領が記録された金額" tone="success" />
                    <StatCard label="未収" value={`${data.fee.remaining.toLocaleString()} 円`} description="残り徴収予定" tone="warn" />
                </section>

                <section className="mt-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
                            <label className="sm:w-1/2">
                                <p className="text-sm font-medium text-gray-700">検索</p>
                                <input
                                    type="text"
                                    value={searchText}
                                    onChange={(event) => setSearchText(event.target.value)}
                                    placeholder="名前・メールで絞り込み"
                                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </label>
                            <div className="flex-1 space-y-2">
                                <p className="text-sm font-medium text-gray-700">受付ステータス</p>
                                <div className="flex flex-wrap gap-2">
                                    {(['all', 'checked', 'pending'] as const).map((value) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => setCheckFilter(value)}
                                            className={`rounded-md px-3 py-2 text-sm font-semibold shadow-sm border ${
                                                checkFilter === value
                                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                            }`}
                                        >
                                            {value === 'all' && 'すべて'}
                                            {value === 'checked' && '受付済み'}
                                            {value === 'pending' && '未受付'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex-1 space-y-2">
                                <p className="text-sm font-medium text-gray-700">事前回答</p>
                                <div className="flex flex-wrap gap-2">
                                    {(['all', 'PRESENCE', 'PRESENCE_PARTIALLY', 'ABSENCE', 'UNANSWERED'] as const).map((value) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => setResponseFilter(value)}
                                            className={`rounded-md px-3 py-2 text-sm font-semibold shadow-sm border ${
                                                responseFilter === value
                                                    ? 'border-slate-700 bg-slate-900 text-white'
                                                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                            }`}
                                        >
                                            {value === 'all' ? '指定なし' : statusLabel(value as AttendanceStatus)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => void load()}
                                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:border-gray-300"
                            >
                                最新の状態を取得
                            </button>
                        </div>
                    </div>
                    {actionMessage && (
                        <p className="mt-3 text-sm text-gray-700">{actionMessage}</p>
                    )}
                </section>

                <section className="mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                    <table className="min-w-[1080px] w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left font-medium text-gray-700">参加者</th>
                                <th className="px-4 py-3 text-left font-medium text-gray-700">メール</th>
                                <th className="px-4 py-3 text-left font-medium text-gray-700">事前回答</th>
                                <th className="px-4 py-3 text-left font-medium text-gray-700">更新</th>
                                <th className="px-4 py-3 text-left font-medium text-gray-700">会費</th>
                                <th className="px-4 py-3 text-left font-medium text-gray-700">受付</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {filteredAttendees.length === 0 && (
                                <tr>
                                    <td className="px-4 py-6 text-center text-gray-500" colSpan={6}>
                                        対象の参加者がいません。
                                    </td>
                                </tr>
                            )}
                            {filteredAttendees.map((attendee) => (
                                <tr key={attendee.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 font-medium text-gray-900">{attendee.name}</td>
                                    <td className="px-4 py-3 text-gray-700">{attendee.email}</td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusBadge(attendee.response)}`}>
                                            {statusLabel(attendee.response)}
                                        </span>
                                        {attendee.comment && (
                                            <p className="mt-1 text-xs text-gray-500 truncate" title={attendee.comment}>{attendee.comment}</p>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">
                                        <div className="text-xs">{formatDateTime(attendee.updatedAt)}</div>
                                        {attendee.receptionUpdatedAt && (
                                            <div className="text-[11px] text-gray-500">受付: {formatDateTime(attendee.receptionUpdatedAt)}</div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">{attendee.feeAmount !== null ? `${attendee.feeAmount.toLocaleString()} 円` : '未設定'}</p>
                                                    <p className="text-xs text-gray-600">{attendee.feePaid > 0 ? `徴収済み ${attendee.feePaid.toLocaleString()} 円` : '未徴収'}</p>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {!(attendee.feeAmount !== null && attendee.feePaid === attendee.feeAmount) && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleFullPayment(attendee)}
                                                            disabled={payingId === attendee.id || attendee.feeAmount === null}
                                                            className={`rounded-md px-3 py-2 text-sm font-semibold shadow-sm transition ${
                                                                payingId === attendee.id || attendee.feeAmount === null
                                                                    ? 'border border-gray-200 bg-white text-gray-400 cursor-not-allowed'
                                                                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                                            }`}
                                                        >
                                                            {payingId === attendee.id ? '更新中…' : '全額徴収'}
                                                        </button>
                                                    )}
                                                    {!(attendee.feeAmount !== null && attendee.feePaid === attendee.feeAmount) && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setPartialEditingId(attendee.id);
                                                                setPartialInputs((previous) => ({ ...previous, [attendee.id]: previous[attendee.id] ?? (attendee.feePaid > 0 ? attendee.feePaid.toString() : '') }));
                                                                setPartialErrors((previous) => ({ ...previous, [attendee.id]: '' }));
                                                            }}
                                                            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 shadow-sm transition hover:border-gray-300"
                                                        >
                                                            一部徴収
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            {partialEditingId === attendee.id && (
                                                <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
                                                    <label className="block text-sm font-medium text-gray-800">
                                                        徴収額 (円)
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            max={attendee.feeAmount ?? undefined}
                                                            value={partialInputs[attendee.id] ?? ''}
                                                            onChange={(event) => setPartialInputs((previous) => ({ ...previous, [attendee.id]: event.target.value }))}
                                                            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                            placeholder={attendee.feeAmount !== null ? `最大 ${attendee.feeAmount.toLocaleString()} 円` : '金額を入力'}
                                                        />
                                                    </label>
                                                    {partialErrors[attendee.id] && (
                                                        <p className="text-sm text-red-600">{partialErrors[attendee.id]}</p>
                                                    )}
                                                    <div className="flex flex-wrap gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const parsed = Number.parseInt((partialInputs[attendee.id] ?? '').trim(), 10);
                                                                if (Number.isNaN(parsed)) {
                                                                    setPartialErrors((previous) => ({ ...previous, [attendee.id]: '数値を入力してください' }));
                                                                    return;
                                                                }
                                                                setConfirming({ attendee, amount: parsed, label: '一部徴収' });
                                                            }}
                                                            disabled={payingId === attendee.id}
                                                            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                                        >
                                                            保存
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setPartialEditingId(null);
                                                                setPartialErrors((previous) => ({ ...previous, [attendee.id]: '' }));
                                                            }}
                                                            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 shadow-sm transition hover:border-gray-300"
                                                        >
                                                            キャンセル
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                                                attendee.isRecepted
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : 'bg-gray-100 text-gray-700'
                                            }`}>
                                                {attendee.isRecepted ? '受付済み' : '未受付'}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => void toggleReception(attendee.id, !attendee.isRecepted)}
                                                disabled={updatingId === attendee.id}
                                                className={`rounded-md px-3 py-2 text-sm font-semibold shadow-sm transition ${
                                                    attendee.isRecepted
                                                        ? 'border border-gray-200 bg-white text-gray-800 hover:border-gray-300'
                                                        : 'bg-blue-600 text-white hover:bg-blue-700'
                                                } ${updatingId === attendee.id ? 'opacity-60 cursor-not-allowed' : ''}`}
                                            >
                                                {updatingId === attendee.id
                                                    ? '更新中…'
                                                // eslint-disable-next-line sonarjs/no-nested-conditional
                                                    : (attendee.isRecepted
                                                        ? '受付取消'
                                                        : '受付する')}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            </div>

            {confirming && (
                <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4">
                    <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
                        <h3 className="text-lg font-semibold text-gray-900">{confirming.label}の確認</h3>
                        <p className="mt-2 text-sm text-gray-600">{confirming.attendee.name} ({confirming.attendee.email}) に対して {confirming.amount.toLocaleString()} 円を記録します。よろしいですか？</p>
                        <div className="mt-4 grid gap-2 text-sm text-gray-700">
                            <div className="flex justify-between"><span>設定会費</span><span>{confirming.attendee.feeAmount !== null ? `${confirming.attendee.feeAmount.toLocaleString()} 円` : '未設定'}</span></div>
                            <div className="flex justify-between"><span>現在の徴収済み</span><span>{confirming.attendee.feePaid.toLocaleString()} 円</span></div>
                            <div className="flex justify-between font-semibold"><span>今回記録する金額</span><span>{confirming.amount.toLocaleString()} 円</span></div>
                        </div>
                        <div className="mt-6 flex flex-wrap justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setConfirming(null)}
                                className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm hover:border-gray-300"
                            >
                                キャンセル
                            </button>
                            <button
                                type="button"
                                onClick={() => void submitPayment(confirming.attendee, confirming.amount, { success: `${confirming.label}として保存しました` })}
                                disabled={payingId === confirming.attendee.id}
                                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                記録する
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

function StatCard({ label, value, description, tone }: { label: string; value: string; description: string; tone: 'default' | 'success' | 'warn' }) {
    const toneClasses = {
        default: 'bg-white border-gray-200 text-gray-900',
        success: 'bg-emerald-50 border-emerald-100 text-emerald-900',
        warn: 'bg-amber-50 border-amber-100 text-amber-900',
    } as const;

    return (
        <div className={`rounded-lg border p-4 shadow-sm ${toneClasses[tone]}`}>
            <p className="text-sm text-gray-600">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
            <p className="text-sm text-gray-500">{description}</p>
        </div>
    );
}
