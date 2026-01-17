// SPDX-FileCopyrightText: 2026 KATO Hayate <dev@hayatek.jp>
// SPDX-License-Identifier: AGPL-3.0-only

import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
});

export const metadata: Metadata = {
    title: 'Tap\'in出欠',
    description: 'イベントの出欠管理を楽々に。Web上のエディタで招待メールを作成・送信。参加者はメール内のボタンをワンクリックするだけ！ 出欠の集計も一瞬。当日の受付や会費徴収までサポート！',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="ja">
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased`}
            >
                <div
                    style={{
                        minHeight: '90vh',
                        backgroundColor: '#f5f7fa',
                        color: '#111111',
                    }}
                >
                    {children}
                </div>
            </body>
        </html>
    );
}
