'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import RichMailEditor from '@/components/richMailEditor';

import { honoClient } from '@/lib/hono';

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

    const canEdit = mode !== 'view';

    const { groupId, eventId } = useParams<{ groupId: string; eventId: string }>();

    const handleSave = async (): Promise<boolean> => {
        if (!groupId || !eventId) return false;
        setIsSaving(true);
        try {
            if (mode === 'create') {
                await honoClient.api.events[':groupId'][':eventId'].manage.invitation.$post({
                    param: {
                        groupId,
                        eventId,
                    },
                    json: {
                        title: mail.title,
                        content: mail.body,
                    },
                });
                setMode('edit');
            } else {
                await honoClient.api.events[':groupId'][':eventId'].manage.invitation.$patch({
                    param: {
                        groupId,
                        eventId,
                    },
                    json: {
                        title: mail.title,
                        content: mail.body,
                    },
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
                                <div style={{ display: isOpenEditor ? 'none' : 'block' }} >メールタイトル</div>
                                <input
                                    type="text"
                                    value={mail.title}
                                    readOnly={!canEdit}
                                    disabled={!canEdit}
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
                                    style={{ display: isOpenEditor ? 'none' : 'block' }}
                                />
                            </label>
                        </div>

                        {/* 本文 */}
                        <div className="mb-4">
                            <label>
                                <div style={{ display: isOpenEditor ? 'none' : 'block' }} >メール本文</div>
                                <textarea
                                    value={mail.body}
                                    readOnly={!canEdit}
                                    disabled={!canEdit}
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
                                    style={{ display: isOpenEditor ? 'none' : 'block' }}
                                />
                            </label>
                        </div>
                        <RichMailEditor
                            open={isOpenEditor}
                            initialJson={null}
                            onSave={async ({ json, html }) => {
                                // ハッカソン用：とりあえずログ
                                console.log('SAVE JSON', json);
                                console.log('SAVE HTML', html);

                                // 実際はここでAPIへPOST
                                // await fetch('/api/event-mail/custom', { method:'POST', body: JSON.stringify({ customDataJson: json }) })
                                alert('保存処理（仮）を呼びました。consoleを確認してください。');
                            }}
                        />
                    </section>


                    {/* フッター操作 */}
                    <footer className="mt-4">
                        {mode !== 'view' && (
                            <div style={{ display: isOpenEditor ? 'none' : 'block' }} className="flex gap-4">
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
                                <button
                                    onClick={() => setIsOpenEditor(true)}
                                    disabled={isSaving || isSending}
                                    className={`
                                        inline-flex items-center justify-center
                                        rounded-md px-6 py-2
                                        text-base font-medium text-blue-600
                                        hover:bg-blue-100
                                        disabled:opacity-50
                                    `}
                                >
                                    高度な編集
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
