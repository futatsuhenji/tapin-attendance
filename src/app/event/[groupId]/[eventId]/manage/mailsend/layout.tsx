// SPDX-FileCopyrightText: 2026 KATO Hayate <dev@hayatek.jp>
// SPDX-License-Identifier: AGPL-3.0-only

export default function InvitationLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div
            style={{
                minHeight: '90vh',
                backgroundColor: '#ffffff00',
                color: '#111111',
            }}
        >
            {children}
        </div>
    );
}
