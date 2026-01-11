import Link from 'next/link';

import GroupCreateForm from './client';
import { getJwtFromCookieStore } from '@/utils/auth';

export const dynamic = 'force-dynamic';

export default async function GroupCreatePage() {
    const jwt = await getJwtFromCookieStore();
    const ownerId = jwt?.user.id ?? null;

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-3xl px-4 py-10 space-y-6">
                <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-sm text-gray-500">グループ作成</p>
                        <h1 className="text-3xl font-semibold text-gray-900">新しいグループを作成</h1>
                    </div>
                    <Link
                        href="/mypage"
                        className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:border-gray-300"
                    >
                        マイページへ戻る
                    </Link>
                </header>

                <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4">
                    <p className="text-sm text-gray-700">
                        グループを作成すると、イベントの管理や招待、参加者の管理が行えます。
                    </p>
                    <GroupCreateForm ownerId={ownerId} />
                </div>
            </div>
        </div>
    );
}
