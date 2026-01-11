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
        setIsSending(true);
        try {
            const response = await honoClient.api.events[':groupId'][':eventId'].manage.invitation.send.$post({
                param: {
                    groupId,
                    eventId,
                },
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
