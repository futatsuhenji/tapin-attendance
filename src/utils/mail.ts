import { transporter } from '@/lib/nodemailer';
import { AttendanceType } from '@/generated/prisma/enums';

// 出欠タイプの日本語変換マップ
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
    comment,
    editUrl,
}: {
    to: string;
    userName: string;
    eventName: string;
    attendance: AttendanceType;
    comment: string | null;
    editUrl: string;
}) => {
    const statusText = attendanceLabel[attendance] || '未回答';

    await transporter.sendMail({
        from: `Tap'in出欠 <${process.env.SMTP_USER}>`,
        to,
        subject: `【Tap'in出欠】「${eventName}」の回答を受け付けました`,
        html: `
            <!DOCTYPE html>
            <html lang="ja">
                <body style="font-family: sans-serif; line-height: 1.6;">
                    <p>${userName} 様</p>
                    <p>「${eventName}」への出欠回答を受け付けました。回答内容は以下の通りです。</p>
                    <div style="background: #f4f4f4; padding: 15px; border-radius: 5px;">
                        <p style="margin: 0;"><strong>出欠状況:</strong> ${statusText}</p>
                        <p style="margin: 10px 0 0 0;"><strong>コメント:</strong></p>
                        <p style="margin: 0; white-space: pre-wrap;">${comment || '(なし)'}</p>
                    </div>
                    <p>回答内容を変更したい場合は、以下のリンクから再度アクセスしてください。</p>
                    <p><a href="${editUrl}">${editUrl}</a></p>
                    <p style="font-size: 0.9em; color: #666;">※このメールに心当たりがない場合は、お手数ですが破棄してください。</p>
                </body>
            </html>
        `,
    });
};
