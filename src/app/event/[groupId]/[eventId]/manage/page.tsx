// SPDX-FileCopyrightText: 2026 KATO Hayate <dev@hayatek.jp>
// SPDX-License-Identifier: AGPL-3.0-only

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { honoClient } from '@/lib/hono';

type AttendanceStatus = 'PRESENCE' | 'PRESENCE_PARTIALLY' | 'ABSENCE' | 'UNANSWERED';

type EventSummary = {
    name: string;
    description?: string | null;
    place?: string | null;
    mapUrl?: string | null;
    startsAt?: string | null;
    endsAt?: string | null;
    registrationEndsAt?: string | null;
};

type AttendanceSummary = {
    total: number;
    presence: number;
    partial: number;
    absence: number;
    unanswered: number;
};

type FeeSummary = {
    totalDue: number;
    totalPaid: number;
    remaining: number;
};

type FeeData = {
    standardAmount: number | null;
    summary: FeeSummary;
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
        sentAt?: string | null;
        mailSent: boolean;
    };
    attendance: AttendanceSummary;
    attendees: Attendee[];
};

type FetchState = 'idle' | 'loading' | 'error';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

type ImportSummary = {
    dataRows: number;
    validRows: number;
    processed: number;
    createdUsers: number;
    createdAttendances: number;
    mailed: number;
    skipped: {
        empty: number;
        invalidEmail: number;
        duplicate: number;
    };
    mailSent: boolean;
};

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

// eslint-disable-next-line sonarjs/cognitive-complexity
export default function EventManagePage() {
    const { groupId, eventId } = useParams<{ groupId: string; eventId: string }>();

    const [fetchState, setFetchState] = useState<FetchState>('loading');
    const [data, setData] = useState<ManageData | null>(null);
    const [showActionsMobile, setShowActionsMobile] = useState(false);
    const [addEmail, setAddEmail] = useState('');
    const [addName, setAddName] = useState('');
    const [addState, setAddState] = useState<SaveState>('idle');
    const [addError, setAddError] = useState('');

    const [importFile, setImportFile] = useState<File | null>(null);
    const [importHasHeader, setImportHasHeader] = useState(true);
    const [importNameColumn, setImportNameColumn] = useState('1');
    const [importEmailColumn, setImportEmailColumn] = useState('2');
    const [importState, setImportState] = useState<SaveState>('idle');
    const [importError, setImportError] = useState('');
    const [importResult, setImportResult] = useState<ImportSummary | null>(null);

    const [feeData, setFeeData] = useState<FeeData | null>(null);
    const [feeInput, setFeeInput] = useState('');
    const [feeState, setFeeState] = useState<SaveState>('idle');
    const [feeError, setFeeError] = useState('');

    const registrationClosed = useMemo(() => {
        if (!data?.event.registrationEndsAt) return false;
        return new Date(data.event.registrationEndsAt) < new Date();
    }, [data]);

    const reload = async (silent = false) => {
        if (!silent) setFetchState('loading');
        try {
            const response = await honoClient.api.events[':groupId'][':eventId'].manage.$get({
                param: { groupId, eventId },
            });

            if (!response.ok) {
                setFetchState('error');
                return;
            }

            const body = (await response.json()) as ManageData;
            setData(body);
            setFetchState('idle');
            void loadFees();
        } catch (e) {
            console.error(e);
            setFetchState('error');
        }
    };

    const loadFees = async () => {
        if (!groupId || !eventId) return;
        setFeeError('');
        try {
            const response = await honoClient.api.events[':groupId'][':eventId'].manage.fees.$get({
                param: { groupId, eventId },
            });

            if (!response.ok) {
                setFeeError('会費情報の取得に失敗しました');
                return;
            }

            const body = await response.json() as FeeData;
            setFeeData(body);
            setFeeInput(body.standardAmount !== null ? body.standardAmount.toString() : '');
        } catch (e) {
            console.error(e);
            setFeeError('会費情報の取得に失敗しました');
        }
    };

    const handleAddParticipant = async () => {
        if (!groupId || !eventId || !addEmail.trim()) return;
        setAddState('saving');
        setAddError('');
        try {
            const response = await honoClient.api.events[':groupId'][':eventId'].manage.members.$post({
                param: { groupId, eventId },
                json: {
                    email: addEmail.trim(),
                    name: addName.trim() || undefined,
                },
            });

            if (!response.ok) {
                const body = await response.json().catch(() => null) as { message?: string } | null;
                setAddError(body?.message ?? '追加に失敗しました');
                setAddState('error');
                return;
            }

            setAddState('saved');
            setAddEmail('');
            setAddName('');
            await reload(true);
        } catch (e) {
            console.error(e);
            setAddError('追加に失敗しました');
            setAddState('error');
        } finally {
            setTimeout(() => setAddState('idle'), 1200);
        }
    };

    const handleImportCsv = async () => {
        if (!groupId || !eventId || !importFile) return;
        setImportState('saving');
        setImportError('');
        setImportResult(null);
        try {
            const form = new FormData();
            form.set('file', importFile);
            form.set('hasHeader', importHasHeader ? 'true' : 'false');
            form.set('nameColumn', importNameColumn.trim());
            form.set('emailColumn', importEmailColumn.trim());

            const response = await fetch(`/api/events/${groupId}/${eventId}/manage/members/import`, {
                method: 'POST',
                body: form,
            });

            if (!response.ok) {
                const body = await response.json().catch(() => null) as { message?: string } | null;
                setImportError(body?.message ?? 'インポートに失敗しました');
                setImportState('error');
                return;
            }

            const body = await response.json() as { summary?: ImportSummary };
            if (body.summary) setImportResult(body.summary);

            setImportState('saved');
            setImportFile(null);
            await reload(true);
        } catch (e) {
            console.error(e);
            setImportError('インポートに失敗しました');
            setImportState('error');
        } finally {
            setTimeout(() => setImportState('idle'), 1400);
        }
    };

    useEffect(() => {
        void reload();
    }, [groupId, eventId]);

    const handleSaveFee = async () => {
        if (!groupId || !eventId) return;
        const parsed = Number.parseInt(feeInput, 10);
        if (Number.isNaN(parsed) || parsed < 0) {
            setFeeError('0以上の数値を入力してください');
            return;
        }

        setFeeState('saving');
        setFeeError('');
        try {
            const response = await honoClient.api.events[':groupId'][':eventId'].manage.fees.$post({
                param: { groupId, eventId },
                json: { amount: parsed },
            });

            if (!response.ok) {
                setFeeState('error');
                setFeeError('会費設定の保存に失敗しました');
                return;
            }

            const body = await response.json() as FeeData;
            setFeeData(body);
            setFeeInput(body.standardAmount !== null ? body.standardAmount.toString() : '');
            setFeeState('saved');
        } catch (e) {
            console.error(e);
            setFeeState('error');
            setFeeError('会費設定の保存に失敗しました');
        } finally {
            setTimeout(() => setFeeState('idle'), 1200);
        }
    };

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
                データ取得に失敗しました。
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-6xl px-4 py-10">
            <header className="mb-6 flex flex-col gap-4">
                <div>
                    <p className="text-sm text-gray-500">管理ダッシュボード</p>
                    <h1 className="text-3xl font-semibold text-gray-900">{data.event.name}</h1>

                    {data.event.description && (
                        <p className="mt-2 text-gray-700 whitespace-pre-wrap">{data.event.description}</p>
                    )}
                </div>

                <div className="flex items-center justify-between gap-3 md:hidden">
                    <span className="text-sm text-gray-600">操作</span>
                    <button
                        type="button"
                        onClick={() => setShowActionsMobile((v) => !v)}
                        className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:border-gray-300"
                    >
                        {showActionsMobile ? '閉じる' : '表示する'}
                    </button>
                </div>

                <div
                    className={`flex w-full flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-2 ${showActionsMobile ? 'flex' : 'hidden'} md:flex`}
                >
                    <button
                        type="button"
                        onClick={() => void reload()}
                        className="w-full sm:w-auto rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:border-gray-300"
                    >
                        再読み込み
                    </button>
                    <Link
                        href={`/event/${groupId}/${eventId}`}
                        className="w-full sm:w-auto rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:border-gray-300"
                    >
                        イベントページへ
                    </Link>
                    <Link
                        href={`/event/${groupId}/${eventId}/manage/administrators`}
                        className="w-full sm:w-auto rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:border-gray-300"
                    >
                        管理者の追加・管理
                    </Link>
                    <Link
                        href={`/event/${groupId}/${eventId}/manage/event`}
                        className="w-full sm:w-auto rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:border-gray-300"
                    >
                        イベント情報編集
                    </Link>
                    <Link
                        href={`/event/${groupId}/${eventId}/manage/receptions`}
                        className="w-full sm:w-auto rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:border-gray-300"
                    >
                        当日出欠管理
                    </Link>
                    <Link
                        href={`/event/${groupId}/${eventId}/manage/invitation`}
                        className="w-full sm:w-auto rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
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
                    <p className="mt-1 text-lg font-semibold text-gray-900">{data.event.place || '未設定'}</p>
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

            <section className="mb-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">会費設定</h2>
                        <p className="text-sm text-gray-600">標準会費を設定すると全参加者の会費レコードに適用されます。</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => void loadFees()}
                            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:border-gray-300"
                        >
                            再読み込み
                        </button>
                    </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                    <label className="space-y-1">
                        <span className="text-sm font-medium text-gray-800">標準会費 (円)</span>
                        <input
                            type="number"
                            min={0}
                            value={feeInput}
                            onChange={(event) => setFeeInput(event.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="例: 2000"
                        />
                    </label>
                    <div className="flex gap-2 md:justify-end">
                        <button
                            type="button"
                            onClick={handleSaveFee}
                            disabled={feeState === 'saving'}
                            className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {feeState === 'saving' ? '適用中…' : '全員に適用'}
                        </button>
                    </div>
                </div>

                {feeError && <p className="mt-2 text-sm text-red-600">{feeError}</p>}
                {feeState === 'saved' && !feeError && <p className="mt-2 text-sm text-emerald-600">会費設定を更新しました</p>}

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <FeeStat label="合計徴収予定" value={feeData ? `${feeData.summary.totalDue.toLocaleString()} 円` : '-'} />
                    <FeeStat label="徴収済み" value={feeData ? `${feeData.summary.totalPaid.toLocaleString()} 円` : '-'} />
                    <FeeStat label="未収" value={feeData ? `${feeData.summary.remaining.toLocaleString()} 円` : '-'} tone="warn" />
                </div>
            </section>

            <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">参加者リスト</h2>
                    <p className="text-sm text-gray-500">最新の出欠状況を表示しています</p>
                </div>
                <div className="mt-4 rounded-md border border-dashed border-gray-200 bg-gray-50 p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h3 className="text-base font-semibold text-gray-900">CSVで一括追加</h3>
                            <p className="text-sm text-gray-600">1行目をヘッダーとして扱うかを選び、列を指定してアップロードします。</p>
                        </div>
                        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                            <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                checked={importHasHeader}
                                onChange={(event) => setImportHasHeader(event.target.checked)}
                            />
                            1行目はヘッダー
                        </label>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end">
                        <label className="space-y-1">
                            <span className="text-sm font-medium text-gray-700">CSVファイル</span>
                            <input
                                type="file"
                                accept=".csv,text/csv"
                                onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                                className="block w-full cursor-pointer text-sm text-gray-800 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:font-medium file:text-white hover:file:bg-blue-700"
                            />
                        </label>
                        <label className="space-y-1">
                            <span className="text-sm font-medium text-gray-700">名前列</span>
                            <input
                                type="text"
                                value={importNameColumn}
                                onChange={(event) => setImportNameColumn(event.target.value)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="例: 1 または name"
                            />
                        </label>
                        <label className="space-y-1">
                            <span className="text-sm font-medium text-gray-700">メール列</span>
                            <input
                                type="text"
                                value={importEmailColumn}
                                onChange={(event) => setImportEmailColumn(event.target.value)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="例: 2 または email"
                            />
                        </label>
                        <div className="flex gap-2 md:justify-end">
                            <button
                                type="button"
                                onClick={handleImportCsv}
                                disabled={importState === 'saving' || !importFile || !importEmailColumn.trim()}
                                className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {importState === 'saving' ? '取り込み中…' : 'CSVをインポート'}
                            </button>
                        </div>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">列番号は1始まり。ヘッダーがある場合は列名でも指定できます。</p>
                    {importError && <p className="mt-2 text-sm text-red-600">{importError}</p>}
                    {importResult && !importError && (
                        <div className="mt-2 space-y-1 text-sm text-gray-700">
                            <p>処理: {importResult.processed} 件 (有効 {importResult.validRows} / {importResult.dataRows} 行)</p>
                            <p className="text-gray-600">
                                新規ユーザー {importResult.createdUsers} ・新規出欠 {importResult.createdAttendances} ・スキップ {importResult.skipped.empty + importResult.skipped.invalidEmail + importResult.skipped.duplicate} ・メール送信 {importResult.mailed}
                                {importResult.mailSent ? ' (既存テンプレートを自動送信)' : ''}
                            </p>
                        </div>
                    )}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-[2fr_2fr_auto] sm:items-end">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">メールアドレス</label>
                        <input
                            type="email"
                            value={addEmail}
                            onChange={(event) => setAddEmail(event.target.value)}
                            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="user@example.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">名前 (任意)</label>
                        <input
                            type="text"
                            value={addName}
                            onChange={(event) => setAddName(event.target.value)}
                            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="表示名を入力"
                        />
                    </div>
                    <div className="flex gap-2 sm:justify-end">
                        <button
                            type="button"
                            onClick={handleAddParticipant}
                            disabled={addState === 'saving' || !addEmail.trim()}
                            className="mt-6 inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {addState === 'saving' ? '追加中…' : '参加者を追加'}
                        </button>
                    </div>
                    {addError && <p className="text-sm text-red-600 sm:col-span-3">{addError}</p>}
                    {addState === 'saved' && !addError && <p className="text-sm text-emerald-600 sm:col-span-3">参加者を追加しました</p>}
                </div>
                <div className="mt-4 overflow-x-auto rounded-md border border-gray-200">
                    <table className="min-w-[820px] md:min-w-full w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left font-medium text-gray-700">名前</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-700">メール</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-700">ステータス</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-700">コメント</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-700">更新</th>
                                {!data.invitation.mailSent && <th className="px-4 py-2 text-left font-medium text-gray-700">操作</th>}
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
                                    {!data.invitation.mailSent && (
                                        <td className="px-4 py-2">
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    if (!groupId || !eventId) return;
                                                    const confirmed = globalThis.confirm('この参加者を削除しますか？');
                                                    if (!confirmed) return;
                                                    const response = await fetch(`/api/events/${groupId}/${eventId}/manage/members`, {
                                                        method: 'DELETE',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ userId: attendee.id }),
                                                    });
                                                    if (!response.ok) {
                                                        const body = await response.json().catch(() => null) as { message?: string } | null;
                                                        alert(body?.message ?? '削除に失敗しました');
                                                        return;
                                                    }
                                                    await reload(true);
                                                }}
                                                className="inline-flex items-center rounded-md border border-red-200 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                                            >
                                                削除
                                            </button>
                                        </td>
                                    )}
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

function FeeStat({ label, value, tone }: { label: string; value: string; tone?: 'warn' }) {
    const base = 'rounded-lg border p-3 shadow-sm';
    const toneClass = tone === 'warn' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-gray-200 bg-gray-50 text-gray-900';
    return (
        <div className={`${base} ${toneClass}`}>
            <p className="text-sm text-gray-600">{label}</p>
            <p className="mt-1 text-xl font-semibold">{value}</p>
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
