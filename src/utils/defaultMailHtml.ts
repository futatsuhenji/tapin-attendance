// SPDX-FileCopyrightText: 2026 iise2xqyz <iise2xqyz@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-only

const button = (label: string, href: string, color: string) =>
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-right:12px;">
        <tr>
            <td style="
            border-radius:8px;background:${color}22;padding:10px 16px;
            ">
                <a href="${href}" target="_blank">
                    ${label}
                    </a>
                </td>
            </tr>
        </table>
    `;

export function DefaultMailHtml(body: string, attendLink: string, absenceLink: string): string {
    return `
    <!-- 外側背景 -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background-color:#f5f7fb;border-collapse:collapse;">
    <tr>
        <td align="center" style="padding:24px 12px;">

            <!-- コンテナ -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                style="max-width:600px;border-collapse:collapse;">

                <!-- 白カード -->
                <tr>
                    <td
                        style="background-color:#ffffff;padding:20px;border:1px solid #e5e7eb;box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

                        <!-- 本文 -->
                        <div style="font-size:14px;line-height:1.6;
                     font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,'Noto Sans JP','Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif;
                     color:#0f172a;">
                                ${body}
                        </div>

                        <!-- ボタン行 -->
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"
                            style="border-collapse:separate;margin:16px auto 0;">
                            <tr>
                                <!-- 参加 -->
                                <td style="padding-right:12px;">
${button('参加', attendLink, '#2563eb')}

                                </td>

                                <!-- 不参加 -->
                                <td>
${button('不参加', absenceLink, '#dc2626')}
                                </td>
                            </tr>
                        </table>

                    </td>
                </tr>

            </table>
        </td>
    </tr>
</table>
    `;

}
