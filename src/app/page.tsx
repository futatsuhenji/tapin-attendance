import Link from 'next/link';

export default function Page() {
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-5xl px-4 py-12 space-y-10">
                <section className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
                    <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-3">
                            <p className="text-sm font-semibold text-blue-600">Tap&apos;in 出欠</p>
                            <h1 className="text-3xl font-semibold text-gray-900">出欠管理をシンプルに。</h1>
                            <p className="text-sm text-gray-600">
                                グループ作成、イベント出欠収集、メール招待をワンストップで。パスワードレスのメールリンクで安全にログインできます。
                            </p>
                            <div className="flex flex-wrap gap-3">
                                <Link
                                    href="/login"
                                    className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                >
                                    ログイン
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="space-y-4">
                    <div className="space-y-1">
                        <h2 className="text-xl font-semibold text-gray-900">できること</h2>
                        <p className="text-sm text-gray-600">実装済みの主要機能をご紹介します。</p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                            <h3 className="text-base font-semibold text-gray-900">グループ作成と管理</h3>
                            <p className="mt-2 text-sm text-gray-700">グループを作成し、管理者を設定できます。イベント作成の前提となる単位です。</p>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-blue-700">
                                <span className="rounded-full bg-blue-50 px-3 py-1">管理ダッシュボード</span>
                            </div>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                            <h3 className="text-base font-semibold text-gray-900">イベント作成と出欠収集</h3>
                            <p className="mt-2 text-sm text-gray-700">イベントを作成し、出欠回答の収集・更新ができます。管理者は管理画面からステータスを確認・編集できます。</p>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-blue-700">
                                <span className="rounded-full bg-blue-50 px-3 py-1">出欠回答ページ</span>
                                <span className="rounded-full bg-blue-50 px-3 py-1">管理ダッシュボード</span>
                            </div>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                            <h3 className="text-base font-semibold text-gray-900">メール招待・リマインド</h3>
                            <p className="mt-2 text-sm text-gray-700">メールリンクで参加者に招待を送れます。リッチな本文編集で案内文を整形できます。</p>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-blue-700">
                                <span className="rounded-full bg-blue-50 px-3 py-1">メールリンク招待</span>
                                <span className="rounded-full bg-blue-50 px-3 py-1">リッチメールエディタ</span>
                            </div>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                            <h3 className="text-base font-semibold text-gray-900">パスワードレスログイン</h3>
                            <p className="mt-2 text-sm text-gray-700">メールアドレスに送る5分有効のリンクでログイン。パスワード管理不要で安全に利用できます。</p>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-blue-700">
                                <span className="rounded-full bg-blue-50 px-3 py-1">マジックリンク</span>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-3">
                    <h3 className="text-lg font-semibold text-gray-900">はじめる手順</h3>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                        <li>ログインページからメールリンクを送信し、届いたリンクでサインイン。</li>
                        <li>グループを作成し、管理者を設定。</li>
                        <li>イベントを作成して招待メールを作成・送信し、回答を確認</li>
                    </ol>
                </section>
            </div>
        </div>
    );
}
