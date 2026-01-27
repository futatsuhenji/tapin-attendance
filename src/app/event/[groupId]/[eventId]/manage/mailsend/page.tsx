'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdownMenu';
import { Button } from '@/components/ui/button';

type RecipientType = 'all' | 'going' | 'went';

export default function MailSendManagePage() {
    const { groupId, eventId } = useParams<{ groupId: string; eventId: string }>();
    const [recipientType, setRecipientType] = useState<RecipientType>('all');
    return (

        <div className="max-w-[1200px] mx-auto px-6 py-6">
            <div className="min-h-screen py-16 px-4">
                <div className="mx-auto bg-white max-w-5xl min-h-[70vh] rounded-none p-8 shadow-md">
                    <header className="mb-6">
                        <h1 className="text-2xl">メール送信
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
                    <div className="mb-4">
                        <label>
                            <div>送信先選択</div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    {/* eslint-disable-next-line sonarjs/no-nested-conditional */}
                                    <Button variant="outline">{recipientType === 'all' ? 'すべての人' : (recipientType === 'going' ? '参加予定の人' : '参加した人')}</Button>
                                </DropdownMenuTrigger>

                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => setRecipientType('all')}>
                                        すべての人
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setRecipientType('going')}>
                                        参加予定の人
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setRecipientType('went')}>
                                        参加した人
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </label>
                    </div>
                    <div className="mb-4">
                        <label>
                            <div>メール本文</div>
                            <textarea
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
                            />
                        </label>
                    </div>
                    <button
                        className={`
                            inline-flex items-center justify-center
                            rounded-md px-6 py-2
                            bg-blue-600 text-white
                            hover:bg-blue-700
                            disabled:opacity-50
                        `}
                    >
                        メール送信
                    </button>
                </div>
            </div>
        </div>
    );
}
