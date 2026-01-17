// SPDX-FileCopyrightText: 2026 KATO Hayate <dev@hayatek.jp>
// SPDX-License-Identifier: AGPL-3.0-only

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import { getMailTransporter } from '@/lib/nodemailer';
import { getPrismaClient } from '@/lib/prisma';
import { buildAttendanceLink } from '@/utils/attendance';
import { AttendanceType } from '@/generated/prisma/enums';
import { getEnvironmentValueOrThrow } from '@/utils/environ';


const MAX_IMPORT_ROWS = 2000;
const emailSchema = z.string().email();

type ParsedCsvRow = {
    email: string;
    name?: string;
};

const normalizeHeader = (value: string): string => value.trim().toLowerCase();

// eslint-disable-next-line sonarjs/cognitive-complexity
function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let current = '';
    let inQuotes = false;

    const pushCell = () => {
        row.push(current);
        current = '';
    };

    const pushRow = () => {
        pushCell();
        rows.push(row);
        row = [];
    };

    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];

        if (char === '"') {
            if (inQuotes && text[index + 1] === '"') {
                current += '"';
                // eslint-disable-next-line sonarjs/updated-loop-counter
                index += 1;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            pushCell();
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
            // eslint-disable-next-line sonarjs/updated-loop-counter
            if (char === '\r' && text[index + 1] === '\n') index += 1;
            pushRow();
        } else {
            current += char;
        }
    }

    if (inQuotes) throw new Error('Unterminated quote in CSV');

    if (current.length > 0 || row.length > 0) pushRow();

    return rows.filter((columns) => columns.some((column) => column.trim() !== ''));
}

function resolveColumnIndex(value: string, header?: string[]): number | null {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const numeric = Number.parseInt(trimmed, 10);
    if (!Number.isNaN(numeric)) {
        const index = numeric - 1;
        return index >= 0 ? index : null;
    }

    if (header) {
        const target = normalizeHeader(trimmed);
        const foundIndex = header.findIndex((cell) => normalizeHeader(cell) === target);
        return foundIndex !== -1 ? foundIndex : null;
    }

    return null;
}


const app = new Hono()
    .get('/', async (c) => {
        const prisma = await getPrismaClient();
        const groupId = c.req.param('groupId')!;
        const eventId = c.req.param('eventId')!;
        return await prisma.$transaction(async (tx) => {
            if (await tx.eventGroup.findUnique({ where: { id: groupId } })) {
                if (await tx.event.findUnique({ where: { id: eventId } })) {
                    const members = await tx.attendance.findMany({
                        select: { user: {
                            select: { id: true, name: true, email: true },
                        } },
                        where: { eventId },
                    });
                    return c.json({ members });
                } else {
                    return c.json({ message: 'Event not found' }, 404);
                }
            } else {
                return c.json({ message: 'Event group not found' }, 404);
            }
        });
    })
    .post(
        '/',
        zValidator(
            'json',
            z.object({
                email: z.string().email(),
                name: z.string().min(1).optional(),
            }),
        ),
        async (c) => {
            const prisma = await getPrismaClient();
            const transporter = await getMailTransporter();
            const groupId = c.req.param('groupId')!;
            const eventId = c.req.param('eventId')!;
            const { email, name } = c.req.valid('json');

            try {
                return await prisma.$transaction(async (tx) => {
                    if (!(await tx.eventGroup.findUnique({ where: { id: groupId } }))) {
                        return c.json({ message: 'Event group not found' }, 404);
                    }

                    const event = await tx.event.findUnique({
                        where: { id: eventId },
                        select: {
                            id: true,
                            registrationEndsAt: true,
                            eventMail: { select: { title: true, content: true } },
                        },
                    });
                    if (!event) {
                        return c.json({ message: 'Event not found' }, 404);
                    }

                    if (event.registrationEndsAt && new Date(event.registrationEndsAt) < new Date()) {
                        return c.json({ message: '回答期限を過ぎています' }, 400);
                    }

                    const user = await tx.user.upsert({
                        where: { email },
                        update: {},
                        create: {
                            email,
                            name: name ?? email,
                        },
                    });

                    const attendance = await tx.attendance.upsert({
                        where: { eventId_userId: { eventId, userId: user.id } },
                        create: { eventId, userId: user.id },
                        update: {},
                        select: {
                            attendance: true,
                            comment: true,
                            updatedAt: true,
                            secret: true,
                        },
                    });

                    const mailSent = event.eventMail
                        ? (await tx.attendance.count({ where: { eventId, attendance: { not: null } } })) > 0
                        : false;

                    if (event.eventMail && mailSent) {
                        const origin = new URL(c.req.url).origin;
                        const attendLink = buildAttendanceLink({ origin, groupId, eventId, token: attendance.secret, action: 'attend' });
                        const absenceLink = buildAttendanceLink({ origin, groupId, eventId, token: attendance.secret, action: 'absence' });

                        const escapeHtml = (text: string) =>
                            text
                                .replaceAll('&', '&amp;')
                                .replaceAll('<', '&lt;')
                                .replaceAll('>', '&gt;')
                                .replaceAll('"', '&quot;')
                                .replaceAll('\'', '&#39;');

                        const toHtml = (text: string) =>
                            (text || '')
                                .split('\n')
                                .map((line) => `<p style="margin: 0 0 8px;">${escapeHtml(line)}</p>`)
                                .join('');

                        const button = (label: string, href: string, color: string) =>
                            `<a href="${href}" style="display:inline-block;padding:10px 16px;border-radius:8px;background:${color};color:#fff;text-decoration:none;font-weight:600;">${label}</a>`;

                        const html = `
                            <div style="font-size:14px;line-height:1.6;">
                                ${toHtml(event.eventMail.content || '')}
                                <div style="margin-top:16px;display:flex;gap:12px;align-items:center;">
                                    ${button('参加', attendLink, '#2563eb')}
                                    ${button('不参加', absenceLink, '#dc2626')}
                                </div>
                            </div>
                        `;
                        const text = `${event.eventMail.content || ''}\n\n参加: ${attendLink}\n不参加: ${absenceLink}`;

                        await transporter.sendMail({
                            from: `Tap'in出欠 <${await getEnvironmentValueOrThrow('SMTP_USER')}>`,
                            to: user.email,
                            subject: event.eventMail.title,
                            html,
                            text,
                        });

                        await tx.attendance.update({
                            where: { eventId_userId: { eventId, userId: user.id } },
                            data: { attendance: AttendanceType.UNANSWERED },
                        });
                    }

                    return c.json({
                        message: 'Participant added',
                        attendee: {
                            id: user.id,
                            name: user.name,
                            email: user.email,
                            status: attendance.attendance ?? AttendanceType.UNANSWERED,
                            comment: attendance.comment,
                            updatedAt: attendance.updatedAt,
                        },
                    }, 201);
                });
            } catch (e) {
                if (e instanceof Response) return e;
                console.error('Failed to add participant', e);
                return c.json({ message: 'Unknown error' }, 500);
            }
        },
    )
    .post('/import',
        // eslint-disable-next-line sonarjs/cognitive-complexity
        async (c) => {
            const prisma = await getPrismaClient();
            const transporter = await getMailTransporter();
            const groupId = c.req.param('groupId')!;
            const eventId = c.req.param('eventId')!;

            const form = await c.req.formData().catch(() => null);
            if (!form) return c.json({ message: 'フォームデータの解析に失敗しました' }, 400);

            const file = form.get('file');
            const nameColumnValue = form.get('nameColumn');
            const emailColumnValue = form.get('emailColumn');
            const hasHeaderValue = form.get('hasHeader');

            if (!(file instanceof File)) return c.json({ message: 'CSVファイルを指定してください' }, 400);
            if (file.size === 0) return c.json({ message: '空のファイルです' }, 400);
            if (file.size > 1_500_000) return c.json({ message: 'ファイルサイズが大きすぎます (最大約1.5MB)' }, 400);

            if (typeof emailColumnValue !== 'string' || !emailColumnValue.trim()) {
                return c.json({ message: 'メールアドレス列を指定してください' }, 400);
            }

            const nameColumnRaw = typeof nameColumnValue === 'string' ? nameColumnValue : '';
            const hasHeader = hasHeaderValue === null ? true : String(hasHeaderValue).toLowerCase() !== 'false';

            let rows: string[][];
            try {
                rows = parseCsv(await file.text());
            } catch (e) {
                console.error('Failed to parse CSV', e);
                return c.json({ message: 'CSVの形式が不正です' }, 400);
            }

            if (rows.length === 0) return c.json({ message: 'CSVにデータがありません' }, 400);
            if (rows.length > MAX_IMPORT_ROWS + 1) return c.json({ message: `行数が多すぎます（最大 ${MAX_IMPORT_ROWS} 行）` }, 400);

            const headerRow = hasHeader ? rows[0] : undefined;
            const emailIndex = resolveColumnIndex(emailColumnValue, headerRow);
            if (emailIndex === null) return c.json({ message: 'メールアドレス列を特定できませんでした' }, 400);
            const nameIndex = nameColumnRaw ? resolveColumnIndex(nameColumnRaw, headerRow) : null;
            if (nameColumnRaw && nameIndex === null) {
                return c.json({ message: '名前列を特定できませんでした' }, 400);
            }

            const startRow = hasHeader ? 1 : 0;
            const dataRowCount = rows.length - startRow;
            let skippedEmpty = 0;
            let skippedInvalidEmail = 0;
            let skippedDuplicate = 0;

            const seen = new Set<string>();
            const parsedRows: ParsedCsvRow[] = [];

            for (let index = startRow; index < rows.length; index += 1) {
                const row = rows[index];
                const email = (row[emailIndex] ?? '').trim();
                const name = nameIndex !== null ? (row[nameIndex] ?? '').trim() : '';

                if (!email) {
                    skippedEmpty += 1;
                    continue;
                }

                if (!emailSchema.safeParse(email).success) {
                    skippedInvalidEmail += 1;
                    continue;
                }

                const key = email.toLowerCase();
                if (seen.has(key)) {
                    skippedDuplicate += 1;
                    continue;
                }
                seen.add(key);

                parsedRows.push({ email, name: name || undefined });
            }

            if (parsedRows.length === 0) {
                return c.json({
                    message: '有効な行がありませんでした',
                    summary: {
                        dataRows: dataRowCount,
                        skipped: {
                            empty: skippedEmpty,
                            invalidEmail: skippedInvalidEmail,
                            duplicate: skippedDuplicate,
                        },
                    },
                }, 400);
            }

            return await prisma.$transaction(async (tx) => {
                if (!(await tx.eventGroup.findUnique({ where: { id: groupId } }))) {
                    return c.json({ message: 'Event group not found' }, 404);
                }

                const event = await tx.event.findUnique({
                    where: { id: eventId },
                    select: {
                        id: true,
                        registrationEndsAt: true,
                        eventMail: { select: { title: true, content: true } },
                    },
                });

                if (!event) {
                    return c.json({ message: 'Event not found' }, 404);
                }

                if (event.registrationEndsAt && new Date(event.registrationEndsAt) < new Date()) {
                    return c.json({ message: '回答期限を過ぎています' }, 400);
                }

                const mailSent = event.eventMail
                    ? (await tx.attendance.count({ where: { eventId, attendance: { not: null } } })) > 0
                    : false;

                const emailList = parsedRows.map((row) => row.email);
                const existingUsers = await tx.user.findMany({
                    where: { email: { in: emailList } },
                    select: { id: true, email: true, name: true },
                });
                const userByEmail = new Map(existingUsers.map((user) => [user.email.toLowerCase(), user]));
                const existingAttendances = await tx.attendance.findMany({
                    where: { eventId, userId: { in: existingUsers.map((user) => user.id) } },
                    select: { userId: true, secret: true },
                });
                const attendanceSecretByUserId = new Map(existingAttendances.map((attendance) => [attendance.userId, attendance.secret]));

                let createdUsers = 0;
                let createdAttendances = 0;
                let processed = 0;
                let mailed = 0;

                const origin = new URL(c.req.url).origin;

                for (const row of parsedRows) {
                    let user = userByEmail.get(row.email.toLowerCase());
                    if (!user) {
                        user = await tx.user.create({
                            data: { email: row.email, name: row.name ?? row.email },
                            select: { id: true, email: true, name: true },
                        });
                        userByEmail.set(row.email.toLowerCase(), user);
                        createdUsers += 1;
                    }

                    let secret = attendanceSecretByUserId.get(user.id);
                    if (!secret) {
                        const attendance = await tx.attendance.create({
                            data: { eventId, userId: user.id },
                            select: { secret: true },
                        });
                        secret = attendance.secret;
                        attendanceSecretByUserId.set(user.id, secret);
                        createdAttendances += 1;
                    }

                    processed += 1;

                    if (event.eventMail && mailSent) {
                        const attendLink = buildAttendanceLink({ origin, groupId, eventId, token: secret, action: 'attend' });
                        const absenceLink = buildAttendanceLink({ origin, groupId, eventId, token: secret, action: 'absence' });

                        const escapeHtml = (text: string) => {
                            return text
                                .replaceAll('&', '&amp;')
                                .replaceAll('<', '&lt;')
                                .replaceAll('>', '&gt;')
                                .replaceAll('"', '&quot;')
                                .replaceAll('\'', '&#39;');
                        };

                        const toHtml = (text: string) => {
                            return (text || '')
                                .split('\n')
                                .map((line) => `<p style="margin: 0 0 8px;">${escapeHtml(line)}</p>`)
                                .join('');
                        };

                        const button = (label: string, href: string, color: string) =>
                            `<a href="${href}" style="display:inline-block;padding:10px 16px;border-radius:8px;background:${color};color:#fff;text-decoration:none;font-weight:600;">${label}</a>`;

                        const html = `
                            <div style="font-size:14px;line-height:1.6;">
                                ${toHtml(event.eventMail.content || '')}
                                <div style="margin-top:16px;display:flex;gap:12px;align-items:center;">
                                    ${button('出席', attendLink, '#2563eb')}
                                    ${button('欠席', absenceLink, '#dc2626')}
                                </div>
                            </div>
                        `;
                        const text = `${event.eventMail.content || ''}\n\n出席: ${attendLink}\n欠席: ${absenceLink}`;

                        await transporter.sendMail({
                            from: `Tap'in出欠 <${await getEnvironmentValueOrThrow('SMTP_USER')}>`,
                            to: user.email,
                            subject: event.eventMail.title,
                            html: `<!DOCTYPE html><html lang="ja"><body>${html}</body></html>`,
                            text,
                        });

                        await tx.attendance.update({
                            where: { eventId_userId: { eventId, userId: user.id } },
                            data: { attendance: AttendanceType.UNANSWERED },
                        });

                        mailed += 1;
                    }
                }

                return c.json({
                    message: 'Import completed',
                    summary: {
                        dataRows: dataRowCount,
                        validRows: parsedRows.length,
                        processed,
                        createdUsers,
                        createdAttendances,
                        mailed,
                        skipped: {
                            empty: skippedEmpty,
                            invalidEmail: skippedInvalidEmail,
                            duplicate: skippedDuplicate,
                        },
                        mailSent,
                    },
                }, 201);
            });
        },
    )
    .delete('/',
        zValidator('json', z.object({ userId: z.cuid() })),
        async (c) => {
            const prisma = await getPrismaClient();
            const groupId = c.req.param('groupId')!;
            const eventId = c.req.param('eventId')!;
            const { userId } = c.req.valid('json');
            return await prisma.$transaction(async (tx) => {
                const mailSent = (await tx.attendance.count({ where: { eventId, attendance: { not: null } } })) > 0;
                if (mailSent) {
                    return c.json({ message: '招待メール送信後は削除できません' }, 400);
                }

                if (await tx.eventGroup.findUnique({ where: { id: groupId } })) {
                    if (await tx.event.findUnique({ where: { id: eventId } })) {
                        if (await tx.user.findUnique({ where: { id: userId } })) {
                            const attendance = await tx.attendance.findUnique({ where: { eventId_userId: { eventId, userId } } });
                            if (attendance) {
                                await tx.attendance.delete({ where: { eventId_userId: { eventId, userId } } });
                                return c.json({ message: 'Member removed' }, 200);
                            } else {
                                return c.json({ message: 'Member not found' }, 404);
                            }
                        } else {
                            return c.json({ message: 'User not found' }, 404);
                        }
                    } else {
                        return c.json({ message: 'Event not found' }, 404);
                    }
                } else {
                    return c.json({ message: 'Event group not found' }, 404);
                }
            });
        },
    );

export default app;
