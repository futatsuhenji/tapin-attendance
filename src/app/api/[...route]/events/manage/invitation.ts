// SPDX-FileCopyrightText: 2026 KATO Hayate <dev@hayatek.jp>
// SPDX-FileCopyrightText: 2026 iise2xqyz <iise2xqyz@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-only

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import { getDefaultMailFrom, getMailTransporter } from '@/lib/nodemailer';
import { PrismaClientKnownRequestError, getPrismaClient } from '@/lib/prisma';
import { buildAttendanceLink } from '@/utils/attendance';
import { Prisma } from '@/generated/prisma/client';
import type { TransactionClient } from '@/lib/prisma';
import { DefaultMailHtml } from '@/utils/defaultMailHtml';


async function isMailSent({ tx, eventId }: {tx: TransactionClient; eventId: string}): Promise<boolean> {
    return !(await tx.attendance.findFirst({ where: { eventId, attendance: null } }));
}

function htmlToText(html: string): string {
    return html
        .replaceAll(/<br\s*\/?>(\s*)/gi, '\n')
        .replaceAll(/<p[^>]*>/gi, '')
        .replaceAll(/<\/p>/gi, '\n')
        // eslint-disable-next-line sonarjs/slow-regex
        .replaceAll(/<[^>]+>/g, '')
        .replaceAll(/\n{3,}/g, '\n\n')
        .trim();
}

function appendTrackingPixel(html: string, pixelUrl: string): string {
    const pixel = `<img src="${pixelUrl}" alt="" width="1" height="1" style="display:block;opacity:0;width:1px;height:1px;margin:0;padding:0;border:0;" aria-hidden="true" />`;
    return `${html}<div style="overflow:hidden;height:1px;width:1px;line-height:1px;">${pixel}</div>`;
}


const app = new Hono()
    .get('/',
        async (c) => {
            const prisma = await getPrismaClient();
            const groupId = c.req.param('groupId')!;
            const eventId = c.req.param('eventId')!;
            return await prisma.$transaction(async (tx) => {
                if (await tx.eventGroup.findUnique({ where: { id: groupId } })) {
                    if (await tx.event.findUnique({ where: { id: eventId } })) {
                        const mail = await tx.eventMail.findUnique({ select: { title: true, content: true, custom: true }, where: { eventId } });
                        if (mail) {
                            const sent = await isMailSent({ tx, eventId });
                            return c.json({ ...mail, isSent: sent });
                        } else {
                            return c.json({ message: 'Mail not found' }, 404);
                        }
                    } else {
                        return c.json({ message: 'Event not found' }, 404);
                    }
                } else {
                    return c.json({ message: 'Event group not found' }, 404);
                }
            });
        },
    )
    .post('/',
        zValidator('json', z.object({
            title: z.string(),
            content: z.string(),
            customJson: z.any().optional(),
            customHtml: z.string().optional(),
        })),
        async (c) => {
            const prisma = await getPrismaClient();
            const groupId = c.req.param('groupId')!;
            const eventId = c.req.param('eventId')!;
            const { title, content, customJson, customHtml } = c.req.valid('json');
            // eslint-disable-next-line sonarjs/cognitive-complexity
            return await prisma.$transaction(async (tx) => {
                if (await tx.eventGroup.findUnique({ where: { id: groupId } })) {
                    if (await tx.event.findUnique({ where: { id: eventId } })) {
                        try {
                            await tx.eventMail.create({
                                data: {
                                    eventId,
                                    title,
                                    content,
                                    custom: customJson ? { json: customJson, html: customHtml ?? null } : undefined,
                                },
                            });
                        } catch (e) {
                            // eslint-disable-next-line unicorn/prefer-ternary
                            if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
                                return c.json({ message: 'Mail already exists' }, 409);
                            } else {
                                return c.json({ message: 'Unknown error' }, 500);
                            }
                        }
                        return c.json({ message: 'Mail created' }, 201);
                    } else {
                        return c.json({ message: 'Event not found' }, 404);
                    }
                } else {
                    return c.json({ message: 'Event group not found' }, 404);
                }
            });
        },
    )
    .patch('/',
        zValidator('json', z.object({
            title: z.string().optional(),
            content: z.string().optional(),
            customJson: z.any().optional(),
            customHtml: z.string().optional(),
        })),
        async (c) => {
            const prisma = await getPrismaClient();
            const groupId = c.req.param('groupId')!;
            const eventId = c.req.param('eventId')!;
            const { title, content, customJson, customHtml } = c.req.valid('json');
            // eslint-disable-next-line sonarjs/cognitive-complexity
            return await prisma.$transaction(async (tx) => {
                if (await isMailSent({ tx, eventId })) {
                    return c.json({ message: 'It\'s no use crying over spilt milk' }, 400);
                }
                if (await tx.eventGroup.findUnique({ where: { id: groupId } })) {
                    if (await tx.event.findUnique({ where: { id: eventId } })) {
                        const mail = await tx.eventMail.findUnique({ where: { eventId } });
                        if (mail) {
                            const data: Prisma.EventMailUpdateInput = {};
                            if (title) data.title = title;
                            if (content) data.content = content;
                            if (customJson !== undefined) {
                                data.custom = customJson === null ? Prisma.JsonNull : ({ json: customJson, html: customHtml ?? null } as Prisma.InputJsonValue);
                            }
                            await tx.eventMail.update({ where: { eventId }, data });
                            return c.json({ message: 'Mail updated' }, 200);
                        } else {
                            return c.json({ message: 'Mail not found' }, 404);
                        }
                    } else {
                        return c.json({ message: 'Event not found' }, 404);
                    }
                } else {
                    return c.json({ message: 'Event group not found' }, 404);
                }
            });
        },
    )
    .delete('/',
        async (c) => {
            const prisma = await getPrismaClient();
            const groupId = c.req.param('groupId')!;
            const eventId = c.req.param('eventId')!;
            return await prisma.$transaction(async (tx) => {
                if (await isMailSent({ tx, eventId })) {
                    return c.json({ message: 'It\'s no use crying over spilt milk' }, 400);
                }
                if (await tx.eventGroup.findUnique({ where: { id: groupId } })) {
                    if (await tx.event.findUnique({ where: { id: eventId } })) {
                        const mail = await tx.eventMail.findUnique({ where: { eventId } });
                        if (mail) {
                            await tx.eventMail.delete({ where: { eventId } });
                            return c.json({ message: 'Mail deleted' }, 200);
                        } else {
                            return c.json({ message: 'Mail not found' }, 404);
                        }
                    } else {
                        return c.json({ message: 'Event not found' }, 404);
                    }
                } else {
                    return c.json({ message: 'Event group not found' }, 404);
                }
            });
        },
    )
    .post('/send',
        async (c) => {
            const prisma = await getPrismaClient();
            const groupId = c.req.param('groupId')!;
            const eventId = c.req.param('eventId')!;
            // eslint-disable-next-line sonarjs/cognitive-complexity
            return await prisma.$transaction(async (tx) => {
                if (await tx.eventGroup.findUnique({ where: { id: groupId } })) {
                    if (await tx.event.findUnique({ where: { id: eventId } })) {
                        const mail = await tx.eventMail.findUnique({ where: { eventId } });
                        if (mail) {
                            const attendees = await tx.attendance.findMany({
                                where: { eventId },
                                select: { secret: true, user: { select: { email: true, name: true } } },
                            });

                            const smtpSetting = await tx.eventSmtpSetting.findUnique({
                                where: { eventId },
                                select: {
                                    host: true,
                                    port: true,
                                    secure: true,
                                    user: true,
                                    password: true,
                                    fromName: true,
                                    fromEmail: true,
                                },
                            });

                            const transporter = await getMailTransporter(smtpSetting
                                ? {
                                    host: smtpSetting.host,
                                    port: smtpSetting.port,
                                    secure: smtpSetting.secure,
                                    auth: { user: smtpSetting.user, pass: smtpSetting.password },
                                }
                                : undefined);

                            const fromAddress = smtpSetting
                                ? `${smtpSetting.fromName?.trim() || 'Tap\'in出欠'} <${smtpSetting.fromEmail?.trim() || smtpSetting.user}>`
                                : await getDefaultMailFrom();

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

                            const origin = process.env.NEXT_PUBLIC_APP_URL!;

                            for (const attendee of attendees) {
                                const attendLink = buildAttendanceLink({ origin, groupId, eventId, token: attendee.secret, action: 'attend' });
                                const absenceLink = buildAttendanceLink({ origin, groupId, eventId, token: attendee.secret, action: 'absence' });
                                const trackingPixelUrl = `${origin}/api/events/${groupId}/${eventId}/open?token=${attendee.secret}`;
                                const customHtml = (mail.custom as { html?: string } | null | undefined)?.html ?? null;

                                const html = customHtml
                                    ? `
                                        <div style="font-size:14px;line-height:1.6;">
                                            ${customHtml}
                                            <div style="margin-top:16px;display:flex;gap:12px;align-items:center;">
                                                <a href="${attendLink}" style="display:inline-block;padding:10px 16px;border-radius:8px;background:#2563eb;color:#fff;text-decoration:none;font-weight:600;">参加</a>
                                                <a href="${absenceLink}" style="display:inline-block;padding:10px 16px;border-radius:8px;background:#dc2626;color:#fff;text-decoration:none;font-weight:600;">不参加</a>
                                            </div>
                                        </div>
                                    `
                                    : DefaultMailHtml(toHtml(mail.content || ''), attendLink, absenceLink);

                                const htmlWithTracking = appendTrackingPixel(html, trackingPixelUrl);

                                const text = customHtml
                                    ? `${htmlToText(customHtml)}\n\n参加: ${attendLink}\n不参加: ${absenceLink}`
                                    : `${mail.content || ''}\n\n参加: ${attendLink}\n不参加: ${absenceLink}`;

                                await transporter.sendMail({
                                    from: fromAddress,
                                    to: attendee.user.email,
                                    subject: mail.title,
                                    html: `<!DOCTYPE html><html lang="ja"><body>${htmlWithTracking}</body></html>`,
                                    text,
                                });
                            }

                            await tx.attendance.updateMany({ where: { eventId }, data: { 'attendance': 'UNANSWERED' } });
                            return c.json({ message: 'Mails sent' }, 201);
                        } else {
                            return c.json({ message: 'Mail not found' }, 404);
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
