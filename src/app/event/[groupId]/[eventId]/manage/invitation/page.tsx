'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

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

    const isReadOnly = mode === 'view';

    const { groupId, eventId } = useParams<{ groupId: string; eventId: string }>();

    const handleSave = () => {
        if (!groupId && !eventId) return;
        (async () => {
            if (mode === 'create') {
                await honoClient.api.event[':groupId'][':eventId'].manage.invitation.$post({
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
                await honoClient.api.event[':groupId'][':eventId'].manage.invitation.$patch({
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
        })();
    };

    useEffect(() => {
        const fetchMail = async () => {
            try {
                const response = await honoClient.api.event[':groupId'][':eventId'].manage.invitation.$get({
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

        <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>

            <div className="min-h-screen bg-gray-50 py-15 px-4">
                <div className="mx-auto bg-white max-w-5xl min-h-[70vh] rounded-none p-8 shadow-md">
                    <header style={{ marginBottom: 24 }}>
                        <h1 className="text-2xl">イベントメール
                            {mode === 'create' && 'の作成'}
                            {mode === 'edit' && 'の編集'}
                            {mode === 'view' && 'の閲覧'}
                        </h1>
                    </header>
                    <section>
                        {/* タイトル */}
                        <div style={{ marginBottom: 16 }}>
                            <label>
                                <div>メールタイトル</div>
                                {mode === 'view' && (
                                    <input
                                        type="text"
                                        value={mail.title}
                                        disabled={isReadOnly}
                                        onChange={(e) =>
                                            setMail({ ...mail, title: e.target.value })
                                        }
                                        className="
    w-full
    px-3 py-2
    border border-gray-300
    rounded-md
    bg-white
    disabled:bg-gray-100
    disabled:border-gray-200
    disabled:text-gray-500
    disabled:cursor-not-allowed
    focus:outline-none
    focus:ring-1 focus:ring-blue-500
  "
                                    />
                                )}
                                {(mode === 'create' || mode === 'edit') && (
                                    <input
                                        onChange={(e) =>
                                            setMail({ ...mail, title: e.target.value })
                                        }
                                        disabled={isReadOnly}
                                        value={mail.title}
                                        type="text"
                                        className="
    w-full
    px-3 py-2
    border border-gray-300
    rounded-md
    bg-white
    focus:outline-none
    focus:border-blue-500
    focus:ring-1 focus:ring-blue-500
                                "
                                    />
                                )}
                            </label>
                        </div>

                        {/* 本文 */}
                        <div style={{ marginBottom: 16 }}>
                            <label>
                                <div>メール本文</div>
                                {mode === 'view' && (
                                    <textarea
                                        value={mail.body}
                                        disabled={isReadOnly}
                                        onChange={(e) =>
                                            setMail({ ...mail, body: e.target.value })
                                        }
                                        rows={12}
                                        className="
    w-full
    px-3 py-2
    border border-gray-300
    rounded-md
    bg-white
    disabled:bg-gray-100
    disabled:border-gray-200
    disabled:text-gray-500
    disabled:cursor-not-allowed
    focus:outline-none
  "
                                    />
                                )}
                                {(mode === 'create' || mode === 'edit') && (
                                    <textarea
                                        value={mail.body}
                                        disabled={isReadOnly}
                                        onChange={(e) =>
                                            setMail({ ...mail, body: e.target.value })
                                        }
                                        rows={12}
                                        className="
    w-full
    px-3 py-2
    border border-gray-300
    rounded-md
    bg-white
    focus:outline-none
    focus:border-blue-500
    focus:ring-1 focus:ring-blue-500
  "
                                    />
                                )}
                            </label>
                        </div>
                    </section>


                    {/* フッター操作 */}
                    <footer style={{ marginTop: 16 }}>
                        {mode !== 'view' && (
                            <button
                                onClick={handleSave}
                                className="
    inline-flex items-center justify-center
    rounded-md px-6 py-2
    text-base font-medium text-blue-600
    hover:bg-blue-100
    disabled:opacity-50
  "
                            >
                                保存
                            </button>
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
