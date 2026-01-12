// SPDX-FileCopyrightText: 2026 KATO Hayate <dev@hayatek.jp>
// SPDX-License-Identifier: AGPL-3.0-only

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { honoClient } from '@/lib/hono';

type EventForm = {
    name: string;
    description: string;
    place: string;
    mapUrl: string;
    allowVisitorListSharing: boolean;
    registrationEndsAt: string; // datetime-local string
    startsAt: string; // datetime-local string
    endsAt: string; // datetime-local string
};

type FetchState = 'idle' | 'loading' | 'error';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function isoToLocalInput(value: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    // eslint-disable-next-line unicorn/consistent-function-scoping
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function localToIso(value: string): string | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export default function EventEditPage() {
    const { groupId, eventId } = useParams<{ groupId: string; eventId: string }>();

    const [fetchState, setFetchState] = useState<FetchState>('loading');
    const [saveState, setSaveState] = useState<SaveState>('idle');
    const [message, setMessage] = useState<string | null>(null);
    const [invitationSent, setInvitationSent] = useState(false);
    const [form, setForm] = useState<EventForm>({
        name: '',
        description: '',
        place: '',
        mapUrl: '',
        allowVisitorListSharing: false,
        registrationEndsAt: '',
        startsAt: '',
        endsAt: '',
    });

    useEffect(() => {
        const load = async () => {
            if (!groupId || !eventId) return;
            setFetchState('loading');
            setMessage(null);
            try {
                const [eventResponse, invitationResponse] = await Promise.all([
                    honoClient.api.events[':groupId'][':eventId'].$get({ param: { groupId, eventId } }),
                    honoClient.api.events[':groupId'][':eventId'].manage.invitation.$get({ param: { groupId, eventId } }).catch(() => null),
                ]);

                if (!eventResponse.ok) {
                    setFetchState('error');
                    return;
                }

                const eventData = await eventResponse.json() as { event: { name: string; description: string | null; place: string | null; mapUrl: string | null; allowVisitorListSharing?: boolean; registrationEndsAt: string | null; startsAt: string | null; endsAt: string | null } };

                setForm({
                    name: eventData.event.name || '',
                    description: eventData.event.description || '',
                    place: eventData.event.place || '',
                    mapUrl: eventData.event.mapUrl || '',
                    allowVisitorListSharing: Boolean(eventData.event.allowVisitorListSharing),
                    registrationEndsAt: isoToLocalInput(eventData.event.registrationEndsAt),
                    startsAt: isoToLocalInput(eventData.event.startsAt),
                    endsAt: isoToLocalInput(eventData.event.endsAt),
                });

                if (invitationResponse?.ok) {
                    const invitation = await invitationResponse.json() as { isSent?: boolean };
                    setInvitationSent(Boolean(invitation.isSent));
                } else {
                    setInvitationSent(false);
                }

                setFetchState('idle');
            } catch (e) {
                console.error(e);
                setFetchState('error');
                setMessage('データの取得に失敗しました');
            }
        };

        load();
    }, [eventId, groupId]);

    const disabled = fetchState === 'loading' || saveState === 'saving';

    const handleChange = <K extends keyof EventForm>(key: K, value: EventForm[K]) => {
        setForm((previous) => ({ ...previous, [key]: value }));
    };

    const handleSave = async () => {
        if (!groupId || !eventId) return;
        setSaveState('saving');
        setMessage(null);
        try {
            const registrationEndsAt = localToIso(form.registrationEndsAt);
            const startsAt = localToIso(form.startsAt);
            const endsAt = localToIso(form.endsAt);
            const response = await honoClient.api.events[':groupId'][':eventId'].$patch({
                param: { groupId, eventId },
                json: {
                    name: form.name,
                    description: form.description,
                    place: form.place,
                    mapUrl: form.mapUrl,
                    allowVisitorListSharing: form.allowVisitorListSharing,
                    registrationEndsAt: registrationEndsAt ?? undefined,
                    startsAt: startsAt ?? undefined,
                    endsAt: endsAt ?? undefined,
                },
            });

            if (!response.ok) {
                setSaveState('error');
                setMessage('保存に失敗しました');
                return;
            }

            setSaveState('saved');
            setMessage('保存しました');
        } catch (e) {
            console.error(e);
            setSaveState('error');
            setMessage('保存に失敗しました');
        }
    };

    return (
        <div className="mx-auto max-w-4xl px-4 py-8">
            <header className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <p className="text-sm text-gray-500">イベント情報編集</p>
                    <h1 className="text-2xl font-semibold text-gray-900">{form.name || 'イベント情報'}</h1>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <Link
                        href={`/event/${groupId}/${eventId}/manage`}
                        className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:border-gray-300"
                    >
                        ダッシュボードへ戻る
                    </Link>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={disabled}
                        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {saveState === 'saving' ? '保存中…' : '保存'}
                    </button>
                </div>
            </header>

            {fetchState === 'loading' ? (
                <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm text-gray-600">読込中…</div>
            ) : (
                <div className="space-y-6">
                    <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-gray-900">基本情報</h2>
                        <div className="mt-4 space-y-4">
                            <Field label="イベント名" required>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={(e) => handleChange('name', e.target.value)}
                                    disabled={disabled}
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                                    placeholder="例: キックオフミーティング"
                                />
                            </Field>

                            <Field label="説明">
                                <textarea
                                    value={form.description}
                                    onChange={(e) => handleChange('description', e.target.value)}
                                    disabled={disabled}
                                    rows={3}
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                                    placeholder="例: 目的やアジェンダなど"
                                />
                            </Field>

                            <Field label="場所" required>
                                <input
                                    type="text"
                                    value={form.place}
                                    onChange={(e) => handleChange('place', e.target.value)}
                                    disabled={disabled}
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                                    placeholder="例: 第1会議室"
                                />
                            </Field>

                            <Field label="地図URL">
                                <input
                                    type="url"
                                    value={form.mapUrl}
                                    onChange={(e) => handleChange('mapUrl', e.target.value)}
                                    disabled={disabled}
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                                    placeholder="https://"
                                />
                            </Field>

                            <Field label="参加者一覧の共有可否">
                                <div>
                                    <label className="inline-flex items-center gap-2 text-gray-800">
                                        <input
                                            type="checkbox"
                                            checked={form.allowVisitorListSharing}
                                            onChange={(e) => handleChange('allowVisitorListSharing', e.target.checked)}
                                            disabled={disabled || invitationSent}
                                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span>参加者同士でリストを閲覧できるようにする</span>
                                    </label>
                                    {invitationSent && (
                                        <p className="mt-1 text-sm text-gray-500">招待メール送信済みのため、この設定は編集できません</p>
                                    )}
                                </div>
                            </Field>
                        </div>
                    </section>

                    <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-gray-900">スケジュール</h2>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <Field label="開始日時" required>
                                <input
                                    type="datetime-local"
                                    value={form.startsAt}
                                    onChange={(e) => handleChange('startsAt', e.target.value)}
                                    disabled={disabled}
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                                />
                            </Field>
                            <Field label="終了日時" required>
                                <input
                                    type="datetime-local"
                                    value={form.endsAt}
                                    onChange={(e) => handleChange('endsAt', e.target.value)}
                                    disabled={disabled}
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                                />
                            </Field>
                            <Field label="回答期限">
                                <input
                                    type="datetime-local"
                                    value={form.registrationEndsAt}
                                    onChange={(e) => handleChange('registrationEndsAt', e.target.value)}
                                    disabled={disabled}
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                                />
                            </Field>
                        </div>
                        <p className="mt-2 text-sm text-gray-500">保存するとイベント情報が更新されます。</p>
                    </section>

                    {message && (
                        <div className={`rounded-md border px-4 py-3 text-sm ${saveState === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                            {message}
                        </div>
                    )}
                </div>
            )}
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
