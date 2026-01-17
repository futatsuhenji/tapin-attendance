// SPDX-FileCopyrightText: 2026 KATO Hayate <dev@hayatek.jp>
// SPDX-FileCopyrightText: 2026 iise2xqyz <iise2xqyz@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-only

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import RichMailEditor from '@/components/richMailEditor';

import { honoClient } from '@/lib/hono';
import type { JSONContent } from '@tiptap/react';

/**
 * - create: 未作成
 * - edit: 保存済み
 * - view: 送付済み
 */
type Mode = 'create' | 'edit' | 'view';

type EventMail = {
    title: string;
    body: string;
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

type SmtpSettingState = {
    enabled: boolean;
    host: string;
    port: string;
    secure: boolean;
    user: string;
    password: string;
    fromName: string;
    fromEmail: string;
    hasPassword: boolean;
};

export default function EventInvitationPage() {

    const [mode, setMode] = useState<Mode>('create');

    const [mail, setMail] = useState<EventMail>({
        title: '',
        body: '',
    });
    const [isSaving, setIsSaving] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [isOpenEditor, setIsOpenEditor] = useState(false);
    const [customJson, setCustomJson] = useState<JSONContent | null>(null);
    const [customHtml, setCustomHtml] = useState('');
    const [forceAdvanced, setForceAdvanced] = useState(false);

    const [smtpSetting, setSmtpSetting] = useState<SmtpSettingState>({
        enabled: false,
        host: '',
        port: '465',
        secure: true,
        user: '',
        password: '',
        fromName: '',
        fromEmail: '',
        hasPassword: false,
    });
    const [smtpState, setSmtpState] = useState<SaveState>('idle');
    const [smtpError, setSmtpError] = useState('');

    const canEdit = mode !== 'view';

    const { groupId, eventId } = useParams<{ groupId: string; eventId: string }>();

    // eslint-disable-next-line unicorn/consistent-function-scoping
    const htmlToPlain = (html: string): string => {
        return html
            .replaceAll(/<br\s*\/?>(\s*)/gi, '\n')
            .replaceAll(/<p[^>]*>/gi, '')
            .replaceAll(/<\/p>/gi, '\n')
            // eslint-disable-next-line sonarjs/slow-regex
            .replaceAll(/<[^>]+>/g, '')
            .replaceAll(/\n{3,}/g, '\n\n')
            .trim();
    };

    const loadSmtpSetting = async () => {
        if (!groupId || !eventId) return;
        try {
            const response = await honoClient.api.events[':groupId'][':eventId'].manage.smtp.$get({
                param: { groupId, eventId },
            });

            if (!response.ok) return;
            const data = await response.json() as {
                enabled: boolean;
                host?: string;
                port?: number;
                secure?: boolean;
                user?: string;
                fromName?: string | null;
                fromEmail?: string | null;
                hasPassword?: boolean;
            };

            setSmtpSetting((previous) => ({
                ...previous,
                enabled: Boolean(data.enabled),
                host: data.host ?? '',
                port: data.port !== undefined ? data.port.toString() : '465',
                secure: data.secure ?? true,
                user: data.user ?? '',
                password: '',
                fromName: data.fromName ?? '',
                fromEmail: data.fromEmail ?? '',
                hasPassword: Boolean(data.hasPassword),
            }));
        } catch (e) {
            console.error('Failed to fetch SMTP setting:', e);
        }
    };

    const handleSaveSmtp = async (): Promise<boolean> => {
        if (!groupId || !eventId) return false;
        if (smtpSetting.enabled) {
            const parsed = Number.parseInt(smtpSetting.port, 10);
            if (Number.isNaN(parsed) || parsed <= 0) {
                setSmtpError('ポート番号を正しく入力してください');
                setSmtpState('error');
                setTimeout(() => setSmtpState('idle'), 1200);
                return false;
            }
        }

        setSmtpState('saving');
        setSmtpError('');
        try {
            const payload = smtpSetting.enabled
                ? {
                    enabled: true,
                    host: smtpSetting.host.trim(),
                    port: Number.parseInt(smtpSetting.port, 10),
                    secure: smtpSetting.secure,
                    user: smtpSetting.user.trim(),
                    password: smtpSetting.password.trim() || undefined,
                    fromName: smtpSetting.fromName.trim() || undefined,
                    fromEmail: smtpSetting.fromEmail.trim() || undefined,
                }
                : { enabled: false };

            const response = await honoClient.api.events[':groupId'][':eventId'].manage.smtp.$put({
                param: { groupId, eventId },
                json: payload,
            });

            if (!response.ok) {
                const body = await response.json().catch(() => null) as { message?: string } | null;
                setSmtpError(body?.message ?? '送信元設定の保存に失敗しました');
                setSmtpState('error');
                return false;
            }

            setSmtpState('saved');
            setSmtpSetting((previous) => ({
                ...previous,
                password: '',
                hasPassword: payload.enabled ? (previous.hasPassword || Boolean(payload.password)) : false,
            }));
            return true;
        } catch (e) {
            console.error('Failed to save SMTP setting:', e);
            setSmtpError('送信元設定の保存に失敗しました');
            setSmtpState('error');
            return false;
        } finally {
            setTimeout(() => setSmtpState('idle'), 1200);
        }
    };

    const handleSave = async (): Promise<boolean> => {
        if (!groupId || !eventId) return false;
        setIsSaving(true);
        try {
            const basePayload: { title: string; content: string; customJson?: unknown; customHtml?: string } = {
                title: mail.title,
                content: mail.body,
            };
            if (customJson) {
                basePayload.customJson = customJson;
                basePayload.customHtml = customHtml || undefined;
            }
            if (mode === 'create') {
                await honoClient.api.events[':groupId'][':eventId'].manage.invitation.$post({
                    param: {
                        groupId,
                        eventId,
                    },
                    json: basePayload,
                });
                setMode('edit');
            } else {
                await honoClient.api.events[':groupId'][':eventId'].manage.invitation.$patch({
                    param: {
                        groupId,
                        eventId,
                    },
                    json: basePayload,
                });
            }
            return true;
        } catch (e) {
            console.error('Failed to save mail:', e);
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    const handleSend = async () => {
        if (!groupId || !eventId) return;
        const saved = await handleSave();
        if (!saved) return;
        const smtpSaved = await handleSaveSmtp();
        if (smtpSetting.enabled && !smtpSaved) return;
        setIsSending(true);
        try {
            const response = await honoClient.api.events[':groupId'][':eventId'].manage.invitation.send.$post({
                param: {
                    groupId,
                    eventId,
                },
                json: {},
            });
            if (response.ok) {
                setMode('view');
                setIsOpenEditor(false);
            }
        } catch (e) {
            console.error('Failed to send mail:', e);
        } finally {
            setIsSending(false);
        }
    };

    useEffect(() => {
        const fetchMail = async () => {
            try {
                const response = await honoClient.api.events[':groupId'][':eventId'].manage.invitation.$get({
                    param: {
                        groupId,
                        eventId,
                    },
                });

                if (response.ok) {
                    const data = await response.json();
                    setMail({
                        title: data.title,
                        body: data.content || '',
                    });
                    setCustomJson(data.custom?.json ?? null);
                    setCustomHtml(typeof data.custom?.html === 'string' ? data.custom.html : '');
                    setForceAdvanced(Boolean(data.custom?.json));
                    if (data.custom?.json) setIsOpenEditor(true);
                    if (data.isSent) {
                        setMode('view');
                    } else {
                        setMode('edit');
                    }
                } else if (response.status === 404) {
                    setMode('create');
                }
            } catch (e) {
                console.error('Failed to fetch mail:', e);
                // エラー時は作成モードにフォールバック
                setMode('create');
            }
        };

        if (groupId && eventId) {
            fetchMail();
            void loadSmtpSetting();
        }
    }, [groupId, eventId]);

    const showEditor = isOpenEditor || mode === 'view';

    return (

        <div className="max-w-[1200px] mx-auto px-6 py-6">
            <div className="min-h-screen py-16 px-4">
                <div className="mx-auto bg-white max-w-5xl min-h-[70vh] rounded-none p-8 shadow-md">
                    <header className="mb-6">
                        <h1 className="text-2xl">イベントメール
                            {mode === 'create' && 'の作成'}
                            {mode === 'edit' && 'の編集'}
                            {mode === 'view' && 'の閲覧'}
                        </h1>
                        <div className="mt-3">
                            <Link
                                href={`/event/${groupId}/${eventId}/manage`}
                                className="inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:border-gray-300"
                            >
                                ダッシュボードへ戻る
                            </Link>
                        </div>
                    </header>
                    <section>
                        {/* タイトル */}
                        <div className="mb-4">
                            <label>
                                <div style={{ display: showEditor ? 'none' : 'block' }} >メールタイトル</div>
                                <input
                                    type="text"
                                    value={mail.title}
                                    readOnly={!canEdit || forceAdvanced}
                                    disabled={!canEdit || forceAdvanced}
                                    onChange={(e) =>
                                        setMail({ ...mail, title: e.target.value })
                                    }
                                    className={`
                                        w-full
                                        px-3 py-2
                                        border border-gray-300
                                        rounded-md
                                        bg-white
                                        focus:outline-none
                                        focus:ring-1 focus:ring-blue-500
                                        disabled:bg-gray-100
                                        disabled:border-gray-200
                                        disabled:text-gray-500
                                        disabled:cursor-not-allowed
                                    `}
                                    style={{ display: showEditor ? 'none' : 'block' }}
                                />
                            </label>
                        </div>

                        {/* 本文 */}
                        <div className="mb-4">
                            <label>
                                <div style={{ display: showEditor ? 'none' : 'block' }} >メール本文</div>
                                <textarea
                                    value={mail.body}
                                    readOnly={!canEdit || forceAdvanced}
                                    disabled={!canEdit || forceAdvanced}
                                    onChange={(e) =>
                                        setMail({ ...mail, body: e.target.value })
                                    }
                                    rows={12}
                                    className={`
                                        w-full
                                        px-3 py-2
                                        border border-gray-300
                                        rounded-md
                                        bg-white
                                        focus:outline-none
                                        focus:ring-1 focus:ring-blue-500
                                        disabled:bg-gray-100
                                        disabled:border-gray-200
                                        disabled:text-gray-500
                                        disabled:cursor-not-allowed
                                    `}
                                    style={{ display: showEditor ? 'none' : 'block' }}
                                />
                            </label>
                        </div>
                        {showEditor && (
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700">メールタイトル</label>
                                <input
                                    type="text"
                                    value={mail.title}
                                    readOnly={!canEdit}
                                    disabled={!canEdit}
                                    onChange={(e) => setMail({ ...mail, title: e.target.value })}
                                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:border-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed"
                                />
                            </div>
                        )}
                        {showEditor && (
                            <RichMailEditor
                                key={customJson ? JSON.stringify(customJson) : 'empty'}
                                open={showEditor}
                                initialJson={customJson}
                                forcePreview={mode === 'view'}
                                readOnly={mode === 'view'}
                                onSave={async ({ json, html }) => {
                                    if (!canEdit || !groupId || !eventId) return;
                                    setIsSaving(true);
                                    try {
                                        await (mode === 'create' ? honoClient.api.events[':groupId'][':eventId'].manage.invitation.$post({
                                            param: { groupId, eventId },
                                            json: {
                                                title: mail.title,
                                                content: mail.body,
                                                customJson: json,
                                                customHtml: html,
                                            },
                                        }) : honoClient.api.events[':groupId'][':eventId'].manage.invitation.$patch({
                                            param: { groupId, eventId },
                                            json: {
                                                title: mail.title,
                                                content: mail.body,
                                                customJson: json,
                                                customHtml: html,
                                            },
                                        }));
                                        setCustomJson(json);
                                        setCustomHtml(html);
                                        setForceAdvanced(true);
                                        setMode('edit');
                                        alert('保存しました');
                                    } catch (e) {
                                        console.error('Failed to save rich mail:', e);
                                        alert('保存に失敗しました');
                                    } finally {
                                        setIsSaving(false);
                                    }
                                }}
                            />
                        )}
                        {forceAdvanced && canEdit && !isOpenEditor && (
                            <p className="mt-2 text-sm text-amber-700">過去に高度な編集で保存されています。編集は「高度な編集」を使用してください。</p>
                        )}
                    </section>

                    <section className="mt-10 rounded-md border border-gray-200 bg-gray-50 p-5">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">メール送信元設定</h2>
                                <p className="text-sm text-gray-600">イベントごとにSMTP設定とFromを上書きできます。未設定の場合は既定の接続を利用します。</p>
                            </div>
                            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    checked={smtpSetting.enabled}
                                    onChange={(e) => setSmtpSetting((previous) => ({ ...previous, enabled: e.target.checked }))}
                                    disabled={mode === 'view' || isSending || isSaving}
                                />
                                <span>カスタム設定を使用</span>
                            </label>
                        </div>

                        {smtpSetting.enabled ? (
                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">SMTPホスト</label>
                                    <input
                                        type="text"
                                        value={smtpSetting.host}
                                        onChange={(e) => setSmtpSetting((previous) => ({ ...previous, host: e.target.value }))}
                                        disabled={mode === 'view' || isSending || isSaving}
                                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:border-gray-200 disabled:text-gray-500"
                                        placeholder="smtp.example.com"
                                    />
                                </div>
                                <div className="grid grid-cols-[2fr,1fr] items-end gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">ポート</label>
                                        <input
                                            type="number"
                                            value={smtpSetting.port}
                                            onChange={(e) => setSmtpSetting((previous) => ({ ...previous, port: e.target.value }))}
                                            disabled={mode === 'view' || isSending || isSaving}
                                            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:border-gray-200 disabled:text-gray-500"
                                            placeholder="465"
                                        />
                                    </div>
                                    <label className="flex items-center gap-2 text-sm text-gray-700">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            checked={smtpSetting.secure}
                                            onChange={(e) => setSmtpSetting((previous) => ({ ...previous, secure: e.target.checked }))}
                                            disabled={mode === 'view' || isSending || isSaving}
                                        />
                                        <span>TLS</span>
                                    </label>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">ユーザー</label>
                                    <input
                                        type="text"
                                        value={smtpSetting.user}
                                        onChange={(e) => setSmtpSetting((previous) => ({ ...previous, user: e.target.value }))}
                                        disabled={mode === 'view' || isSending || isSaving}
                                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:border-gray-200 disabled:text-gray-500"
                                        placeholder="user@example.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">パスワード</label>
                                    <input
                                        type="password"
                                        value={smtpSetting.password}
                                        onChange={(e) => setSmtpSetting((previous) => ({ ...previous, password: e.target.value }))}
                                        disabled={mode === 'view' || isSending || isSaving}
                                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:border-gray-200 disabled:text-gray-500"
                                        placeholder={smtpSetting.hasPassword ? '未入力の場合は変更しません' : 'SMTPパスワード'}
                                    />
                                    {smtpSetting.hasPassword && (
                                        <p className="mt-1 text-xs text-gray-500">空欄のままにすると保存済みのパスワードを保持します。</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">表示名 (From)</label>
                                    <input
                                        type="text"
                                        value={smtpSetting.fromName}
                                        onChange={(e) => setSmtpSetting((previous) => ({ ...previous, fromName: e.target.value }))}
                                        disabled={mode === 'view' || isSending || isSaving}
                                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:border-gray-200 disabled:text-gray-500"
                                        placeholder="Tap'in出欠"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">送信元メールアドレス</label>
                                    <input
                                        type="email"
                                        value={smtpSetting.fromEmail}
                                        onChange={(e) => setSmtpSetting((previous) => ({ ...previous, fromEmail: e.target.value }))}
                                        disabled={mode === 'view' || isSending || isSaving}
                                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:border-gray-200 disabled:text-gray-500"
                                        placeholder="省略時はユーザーを利用"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">空欄の場合はSMTPユーザーを使用します。</p>
                                </div>
                            </div>
                        ) : (
                            <p className="mt-3 text-sm text-gray-600">カスタム設定を無効にすると、標準のサーバーから送信します。</p>
                        )}

                        {smtpError && <p className="mt-3 text-sm text-red-600">{smtpError}</p>}

                        <div className="mt-4 flex flex-wrap items-center gap-3">
                            <button
                                type="button"
                                onClick={() => void handleSaveSmtp()}
                                disabled={mode === 'view' || smtpState === 'saving' || isSaving || isSending}
                                className="inline-flex items-center justify-center rounded-md bg-white px-4 py-2 text-sm font-medium text-blue-600 shadow-sm ring-1 ring-inset ring-blue-200 transition hover:bg-blue-50 disabled:opacity-50"
                            >
                                {smtpState === 'saving' ? '保存中…' : '送信元設定を保存'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setSmtpSetting({
                                    enabled: false,
                                    host: '',
                                    port: '465',
                                    secure: true,
                                    user: '',
                                    password: '',
                                    fromName: '',
                                    fromEmail: '',
                                    hasPassword: false,
                                })}
                                disabled={mode === 'view' || isSaving || isSending}
                                className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-200 transition hover:bg-gray-100 disabled:opacity-50"
                            >
                                既定設定に戻す
                            </button>
                            {smtpState === 'saved' && (
                                <span className="text-sm text-emerald-600">保存しました</span>
                            )}
                        </div>
                    </section>


                    {/* フッター操作 */}
                    <footer className="mt-4">
                        {mode !== 'view' && (
                            <div className="flex flex-wrap gap-4 items-center">
                                {!forceAdvanced && (
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving || isSending}
                                        className={`
                                            inline-flex items-center justify-center
                                            rounded-md px-6 py-2
                                            text-base font-medium text-blue-600
                                            hover:bg-blue-100
                                            disabled:opacity-50
                                        `}
                                    >
                                        保存
                                    </button>
                                )}
                                <button
                                    onClick={async () => {
                                        if (isOpenEditor) {
                                            if (!canEdit || !groupId || !eventId) return;
                                            setIsSaving(true);
                                            try {
                                                const plain = customHtml ? htmlToPlain(customHtml) : mail.body;
                                                await honoClient.api.events[':groupId'][':eventId'].manage.invitation.$patch({
                                                    param: { groupId, eventId },
                                                    json: {
                                                        title: mail.title,
                                                        content: plain,
                                                    },
                                                });
                                                setMail((previous) => ({ ...previous, body: plain }));
                                                setCustomJson(null);
                                                setCustomHtml('');
                                                setForceAdvanced(false);
                                                setIsOpenEditor(false);
                                            } catch (e) {
                                                console.error('Failed to convert to normal mode:', e);
                                                alert('通常モードへの切り替えに失敗しました');
                                            } finally {
                                                setIsSaving(false);
                                            }
                                        } else {
                                            setIsOpenEditor(true);
                                        }
                                    }}
                                    disabled={isSaving || isSending}
                                    className={`
                                        inline-flex items-center justify-center
                                        rounded-md px-6 py-2
                                        text-base font-medium text-blue-600
                                        hover:bg-blue-100
                                        disabled:opacity-50
                                    `}
                                >
                                    {isOpenEditor ? '通常モードに切り替える' : '高度な編集を開く'}
                                </button>
                                <button
                                    onClick={handleSend}
                                    disabled={isSending || isSaving}
                                    className={`
                                        inline-flex items-center justify-center
                                        rounded-md px-6 py-2
                                        bg-blue-600 text-white
                                        hover:bg-blue-700
                                        disabled:opacity-50
                                    `}
                                >
                                    {isSending ? '送信中…' : 'メール送信'}
                                </button>
                            </div>
                        )}

                        {mode === 'view' && (
                            <p style={{ color: '#666' }}>
                                このメールは送付済みのため編集できません
                            </p>
                        )}
                    </footer>
                </div>
            </div>
        </div>
    );
}
