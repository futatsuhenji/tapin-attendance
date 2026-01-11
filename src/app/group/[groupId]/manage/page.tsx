'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

import { honoClient } from '@/lib/hono';

type GroupDetail = {
    id: string;
    name: string;
    description: string | null;
    ownerId: string;
    ownerName?: string;
    ownerEmail?: string;
};

type Administrator = {
    id: string;
    name: string;
    email: string;
    role: 'owner' | 'admin';
    addedAt: string | null;
};

type EventForm = {
    name: string;
    description: string;
    place: string;
    mapUrl: string;
    allowVisitorListSharing: boolean;
    registrationEndsAt: string; // datetime-local
    startsAt: string; // datetime-local
    endsAt: string; // datetime-local
};

type FetchState = 'idle' | 'loading' | 'error';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function localToIso(value: string): string | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export default function GroupManagePage() {
    const { groupId } = useParams<{ groupId: string }>();
    const router = useRouter();

    const [group, setGroup] = useState<GroupDetail | null>(null);
    const [admins, setAdmins] = useState<Administrator[]>([]);

    const [groupFetchState, setGroupFetchState] = useState<FetchState>('loading');
    const [adminFetchState, setAdminFetchState] = useState<FetchState>('loading');

    const [groupSaveState, setGroupSaveState] = useState<SaveState>('idle');
    const [adminSaveState, setAdminSaveState] = useState<SaveState>('idle');
    const [eventSaveState, setEventSaveState] = useState<SaveState>('idle');

    const [groupName, setGroupName] = useState('');
    const [groupDescription, setGroupDescription] = useState('');

    const [newAdminEmail, setNewAdminEmail] = useState('');

    const [eventForm, setEventForm] = useState<EventForm>({
        name: '',
        description: '',
        place: '',
        mapUrl: '',
        allowVisitorListSharing: false,
        registrationEndsAt: '',
        startsAt: '',
        endsAt: '',
    });

    const isLoading = useMemo(() => groupFetchState === 'loading' || adminFetchState === 'loading', [groupFetchState, adminFetchState]);

    useEffect(() => {
        if (!groupId) return;

        const fetchGroup = async () => {
            setGroupFetchState('loading');
            try {
                const response = await honoClient.api.groups[':groupId'].$get({ param: { groupId } });
                if (!response.ok) {
                    setGroupFetchState('error');
                    return;
                }
                const data = (await response.json()) as GroupDetail;
                setGroup(data);
                setGroupName(data.name);
                setGroupDescription(data.description ?? '');
                setGroupFetchState('idle');
            } catch (e) {
                console.error(e);
                setGroupFetchState('error');
            }
        };

        const fetchAdmins = async () => {
            setAdminFetchState('loading');
            try {
                const response = await honoClient.api.groups[':groupId'].administrators.$get({ param: { groupId } });
                if (!response.ok) {
                    setAdminFetchState('error');
                    return;
                }
                const data = (await response.json()) as { administrators: Administrator[] };
                setAdmins(data.administrators);
                setAdminFetchState('idle');
            } catch (e) {
                console.error(e);
                setAdminFetchState('error');
            }
        };

        fetchGroup();
        fetchAdmins();
    }, [groupId]);

    const handleGroupSave = async () => {
        if (!groupId) return;
        setGroupSaveState('saving');
        try {
            const response = await honoClient.api.groups[':groupId'].$patch({
                param: { groupId },
                json: { name: groupName, description: groupDescription },
            });
            if (!response.ok) {
                setGroupSaveState('error');
                return;
            }
            const updated = (await response.json()) as GroupDetail;
            setGroup(updated);
            setGroupSaveState('saved');
        } catch (e) {
            console.error(e);
            setGroupSaveState('error');
        } finally {
            setTimeout(() => setGroupSaveState('idle'), 1200);
        }
    };

    const handleAdminAdd = async () => {
        if (!groupId || !newAdminEmail.trim()) return;
        setAdminSaveState('saving');
        try {
            const response = await honoClient.api.groups[':groupId'].administrators.$post({
                param: { groupId },
                json: { email: newAdminEmail.trim() },
            });
            if (!response.ok) {
                setAdminSaveState('error');
                return;
            }
            const payload = (await response.json()) as { administrator: Administrator };
            setAdmins((previous) => [...previous, payload.administrator]);
            setNewAdminEmail('');
            setAdminSaveState('saved');
        } catch (e) {
            console.error(e);
            setAdminSaveState('error');
        } finally {
            setTimeout(() => setAdminSaveState('idle'), 1200);
        }
    };

    const handleAdminRemove = async (userId: string) => {
        if (!groupId) return;
        setAdminSaveState('saving');
        try {
            const response = await honoClient.api.groups[':groupId'].administrators.$delete({
                param: { groupId },
                json: { userId },
            });
            if (!response.ok) {
                setAdminSaveState('error');
                return;
            }
            setAdmins((previous) => previous.filter((admin) => admin.id !== userId));
            setAdminSaveState('saved');
        } catch (e) {
            console.error(e);
            setAdminSaveState('error');
        } finally {
            setTimeout(() => setAdminSaveState('idle'), 1200);
        }
    };

    const handleEventCreate = async () => {
        if (!groupId || !group) return;
        setEventSaveState('saving');
        try {
            const registrationEndsAt = localToIso(eventForm.registrationEndsAt);
            const startsAt = localToIso(eventForm.startsAt);
            const endsAt = localToIso(eventForm.endsAt);
            const response = await honoClient.api.events[':groupId'].$post({
                param: { groupId },
                json: {
                    name: eventForm.name,
                    ownerId: group.ownerId,
                    description: eventForm.description || undefined,
                    place: eventForm.place || undefined,
                    mapUrl: eventForm.mapUrl || undefined,
                    startsAt: startsAt ?? undefined,
                    endsAt: endsAt ?? undefined,
                    registrationEndsAt: registrationEndsAt ?? undefined,
                    publishedAt: undefined,
                    allowVisitorListSharing: eventForm.allowVisitorListSharing,
                },
            });

            if (!response.ok) {
                setEventSaveState('error');
                return;
            }

            const created = (await response.json()) as { id: string };
            setEventSaveState('saved');
            router.push(`/event/${groupId}/${created.id}/manage`);
        } catch (e) {
            console.error(e);
            setEventSaveState('error');
        } finally {
            setTimeout(() => setEventSaveState('idle'), 1200);
        }
    };

    if (isLoading || !group) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-700">読込中…</div>
        );
    }

    if (groupFetchState === 'error') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-700">グループ情報を取得できませんでした</div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-6xl px-4 py-10 space-y-8">
                <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-sm text-gray-500">グループ管理</p>
                        <h1 className="text-3xl font-semibold text-gray-900">{group.name}</h1>
                    </div>
                    <Link
                        href={`/event/${groupId}`}
                        className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:border-gray-300"
                    >
                        イベント一覧を表示
                    </Link>
                </header>

                <section className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-900">グループ情報</h2>
                            <span className="text-sm text-gray-500">所有者: {group.ownerName ?? group.ownerEmail ?? group.ownerId}</span>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">グループ名</label>
                                <input
                                    type="text"
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">概要</label>
                                <textarea
                                    value={groupDescription}
                                    onChange={(e) => setGroupDescription(e.target.value)}
                                    rows={3}
                                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={handleGroupSave}
                                disabled={groupSaveState === 'saving'}
                                className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {groupSaveState === 'saving' ? '保存中…' : '保存する'}
                            </button>
                            {groupSaveState === 'saved' && <p className="text-sm text-emerald-600">保存しました</p>}
                            {groupSaveState === 'error' && <p className="text-sm text-red-600">保存に失敗しました</p>}
                        </div>
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-900">グループ管理者</h2>
                            <span className="text-sm text-gray-500">{admins.length} 名</span>
                        </div>
                        <div className="space-y-3">
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-gray-700">メールアドレスを追加</label>
                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <input
                                        type="email"
                                        value={newAdminEmail}
                                        onChange={(e) => setNewAdminEmail(e.target.value)}
                                        className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        placeholder="user@example.com"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAdminAdd}
                                        disabled={adminSaveState === 'saving'}
                                        className="sm:w-auto w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        追加
                                    </button>
                                </div>
                                {adminSaveState === 'error' && <p className="text-sm text-red-600">追加に失敗しました</p>}
                                {adminSaveState === 'saved' && <p className="text-sm text-emerald-600">追加しました</p>}
                            </div>

                            <div className="divide-y divide-gray-200 rounded-md border border-gray-200">
                                {admins.map((admin) => (
                                    <div key={admin.id} className="flex items-center justify-between px-4 py-3">
                                        <div>
                                            <p className="text-sm font-semibold text-gray-900">{admin.name}</p>
                                            <p className="text-xs text-gray-600">{admin.email}</p>
                                            <p className="text-xs text-gray-500">{admin.role === 'owner' ? 'オーナー' : '管理者'}</p>
                                        </div>
                                        {admin.role !== 'owner' && (
                                            <button
                                                type="button"
                                                onClick={() => handleAdminRemove(admin.id)}
                                                disabled={adminSaveState === 'saving'}
                                                className="text-sm text-red-600 hover:text-red-700"
                                            >
                                                削除
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-900">イベント作成</h2>
                        <span className="text-sm text-gray-500">所有者: {group.ownerName ?? group.ownerEmail ?? group.ownerId}</span>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                        <Field label="イベント名" required>
                            <input
                                type="text"
                                value={eventForm.name}
                                onChange={(e) => setEventForm((previous) => ({ ...previous, name: e.target.value }))}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </Field>
                        <Field label="場所">
                            <input
                                type="text"
                                value={eventForm.place}
                                onChange={(e) => setEventForm((previous) => ({ ...previous, place: e.target.value }))}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </Field>
                        <Field label="説明">
                            <textarea
                                value={eventForm.description}
                                onChange={(e) => setEventForm((previous) => ({ ...previous, description: e.target.value }))}
                                rows={3}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </Field>
                        <Field label="地図URL">
                            <input
                                type="url"
                                value={eventForm.mapUrl}
                                onChange={(e) => setEventForm((previous) => ({ ...previous, mapUrl: e.target.value }))}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="https://"
                            />
                        </Field>
                        <Field label="開始日時">
                            <input
                                type="datetime-local"
                                value={eventForm.startsAt}
                                onChange={(e) => setEventForm((previous) => ({ ...previous, startsAt: e.target.value }))}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </Field>
                        <Field label="終了日時">
                            <input
                                type="datetime-local"
                                value={eventForm.endsAt}
                                onChange={(e) => setEventForm((previous) => ({ ...previous, endsAt: e.target.value }))}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </Field>
                        <Field label="回答期限">
                            <input
                                type="datetime-local"
                                value={eventForm.registrationEndsAt}
                                onChange={(e) => setEventForm((previous) => ({ ...previous, registrationEndsAt: e.target.value }))}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </Field>
                        <Field label="参加者リスト共有">
                            <label className="inline-flex items-center gap-2 text-gray-800">
                                <input
                                    type="checkbox"
                                    checked={eventForm.allowVisitorListSharing}
                                    onChange={(e) => setEventForm((previous) => ({ ...previous, allowVisitorListSharing: e.target.checked }))}
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span>参加者同士でリストを閲覧可能にする</span>
                            </label>
                        </Field>
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleEventCreate}
                            disabled={eventSaveState === 'saving'}
                            className="rounded-md bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {eventSaveState === 'saving' ? '作成中…' : 'イベントを作成'}
                        </button>
                        {eventSaveState === 'saved' && <span className="text-sm text-emerald-600">作成しました</span>}
                        {eventSaveState === 'error' && <span className="text-sm text-red-600">作成に失敗しました</span>}
                    </div>
                </section>
            </div>
        </div>
    );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
    return (
        <label className="block text-sm text-gray-800">
            <div className="mb-1 font-medium">
                {label}
                {required && <span className="ml-1 text-red-600">*</span>}
            </div>
            {children}
        </label>
    );
}
