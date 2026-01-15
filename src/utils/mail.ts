// SPDX-FileCopyrightText: 2026 Yu Yokoyama <25w6105e@shinshu-u.ac.jp>
// SPDX-License-Identifier: AGPL-3.0-only

import { getMailTransporter } from '@/lib/nodemailer';
import { AttendanceType } from '@/generated/prisma/enums';
import { getEnvironmentValueOrThrow } from '@/utils/environ';

const attendanceLabel: Record<string, string> = {
    PRESENCE: '出席',
    PRESENCE_PARTIALLY: '遅刻・早退',
    ABSENCE: '欠席',
    UNANSWERED: '未回答',
};

export const sendAttendanceConfirmationMail = async ({
    to,
    userName,
    eventName,
    attendance,
    groupId,
    eventId,
    token,
}: {
    to: string;
    userName: string;
    eventName: string;
    attendance: AttendanceType;
    groupId: string;
    eventId: string;
    token: string;
}) => {
    const transporter = await getMailTransporter();
    const statusText = attendanceLabel[attendance] || '未回答';
    const origin = process.env.NEXT_PUBLIC_APP_URL!;

    const attendUrl = `${origin}/api/events/${groupId}/${eventId}/respond/attend?token=${token}`;
    const absenceUrl = `${origin}/api/events/${groupId}/${eventId}/respond/absence?token=${token}`;
    const editUrl = `${origin}/event/${groupId}/${eventId}?token=${token}`;

    await transporter.sendMail({
        from: `"Tap'in出欠" <${await getEnvironmentValueOrThrow('SMTP_USER')}>`,
        to,
        subject: `【Tap'in出欠】「${eventName}」回答控え`,
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; line-height: 1.6; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 20px auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
        .header { background-color: #f8fafc; padding: 24px; text-align: center; border-bottom: 1px solid #e5e7eb; }
        .header h1 { margin: 0; color: #1e293b; font-size: 20px; }
        .content { padding: 32px; }
        .status-card { background-color: #f1f5f9; border-radius: 6px; padding: 20px; margin: 20px 0; text-align: center; }
        .status-label { font-size: 14px; color: #64748b; margin-bottom: 4px; }
        .status-value { font-size: 22px; font-weight: bold; color: #0f172a; }
        .btn { display: inline-block; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px; text-align: center; color: #ffffff !important; }
        .btn-blue { background-color: #2563eb; }
        .btn-red { background-color: #ef4444; }
        .footer { background-color: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; }
        .info-box { font-size: 14px; color: #475569; background: #fff; padding: 16px; border-radius: 6px; border: 1px dashed #cbd5e1; margin-top: 24px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Tap'in 出欠回答</h1>
        </div>
        <div class="content">
            <p>${userName} 様</p>
            <p>「<strong>${eventName}</strong>」への出欠回答を受け付けました。</p>

            <div class="status-card">
                <div class="status-label">現在の回答</div>
                <div class="status-value">${statusText}</div>
            </div>

            <div style="text-align: center; margin-top: 32px;">
                <p style="font-weight: bold; font-size: 14px; color: #64748b; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.05em;">クイック変更</p>
                <div style="text-align: center; margin-top: 12px;">
                    <a href="${attendUrl}" class="btn btn-blue" style="display: inline-block; margin: 4px;">出席に変更</a>
                    <a href="${absenceUrl}" class="btn btn-red" style="display: inline-block; margin: 4px;">欠席に変更</a>
                </div>
            </div>

            <div class="info-box">
                遅刻・早退の場合や、コメントを入力・編集したい場合は、以下のWebページよりお手続きください。<br>
                <a href="${editUrl}" style="color: #2563eb; text-decoration: underline; word-break: break-all;">${editUrl}</a>
            </div>
        </div>
        <div class="footer">
            &copy; Tap'in - シンプルな出欠管理ツール
        </div>
    </div>
</body>
</html>
        `,
    });
};
