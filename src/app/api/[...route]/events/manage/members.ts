// SPDX-FileCopyrightText: 2026 KATO Hayate <dev@hayatek.jp>
// SPDX-License-Identifier: AGPL-3.0-only

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import { transporter } from '@/lib/nodemailer';
import { prisma } from '@/lib/prisma';
import { buildAttendanceLink } from '@/utils/attendance';
import { AttendanceType } from '@/generated/prisma/enums';


const app = new Hono()
    .get('/', async (c) => {
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
                            from: `Tap'in出欠 <${process.env.SMTP_USER}>`,
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
    .delete('/',
        zValidator('json', z.object({ userId: z.cuid() })),
        async (c) => {
            const groupId = c.req.param('groupId')!;
            const eventId = c.req.param('eventId')!;
            const { userId } = c.req.valid('json');
            return await prisma.$transaction(async (tx) => {
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
