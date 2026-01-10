import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import { transporter } from '@/lib/nodemailer';
import { PrismaClientKnownRequestError, prisma } from '@/lib/prisma';
import { buildAttendanceLink } from '@/utils/attendance';

import type { TransactionClient } from '@/lib/prisma';


async function isMailSent({ tx, eventId }: {tx: TransactionClient; eventId: string}): Promise<boolean> {
    return !(await tx.attendance.findFirst({ where: { eventId, attendance: null } }));
}


const app = new Hono()
    .get('/',
        async (c) => {
            const groupId = c.req.param('groupId')!;
            const eventId = c.req.param('eventId')!;
            return await prisma.$transaction(async (tx) => {
                if (await tx.eventGroup.findUnique({ where: { id: groupId } })) {
                    if (await tx.event.findUnique({ where: { id: eventId } })) {
                        const mail = await tx.eventMail.findUnique({ select: { title: true, content: true }, where: { eventId } });
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
        })),
        async (c) => {
            const groupId = c.req.param('groupId')!;
            const eventId = c.req.param('eventId')!;
            const { title, content } = c.req.valid('json');
            return await prisma.$transaction(async (tx) => {
                if (await tx.eventGroup.findUnique({ where: { id: groupId } })) {
                    if (await tx.event.findUnique({ where: { id: eventId } })) {
                        try {
                            await tx.eventMail.create({ data: { eventId, title, content } });
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
        })),
        async (c) => {
            const groupId = c.req.param('groupId')!;
            const eventId = c.req.param('eventId')!;
            const { title, content } = c.req.valid('json');
            // eslint-disable-next-line sonarjs/cognitive-complexity
            return await prisma.$transaction(async (tx) => {
                if (await isMailSent({ tx, eventId })) {
                    return c.json({ message: 'It\'s no use crying over spilt milk' }, 400);
                }
                if (await tx.eventGroup.findUnique({ where: { id: groupId } })) {
                    if (await tx.event.findUnique({ where: { id: eventId } })) {
                        const mail = await tx.eventMail.findUnique({ where: { eventId } });
                        if (mail) {
                            const data: { title?: string; content?: string } = {};
                            if (title) data.title = title;
                            if (content) data.content = content;
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
            const groupId = c.req.param('groupId')!;
            const eventId = c.req.param('eventId')!;
            return await prisma.$transaction(async (tx) => {
                if (await tx.eventGroup.findUnique({ where: { id: groupId } })) {
                    if (await tx.event.findUnique({ where: { id: eventId } })) {
                        const mail = await tx.eventMail.findUnique({ where: { eventId } });
                        if (mail) {
                            const attendees = await tx.attendance.findMany({
                                where: { eventId },
                                select: { secret: true, user: { select: { email: true, name: true } } },
                            });

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

                            const origin = new URL(c.req.url).origin;

                            for (const attendee of attendees) {
                                const attendLink = buildAttendanceLink({ origin, groupId, eventId, token: attendee.secret, action: 'attend' });
                                const absenceLink = buildAttendanceLink({ origin, groupId, eventId, token: attendee.secret, action: 'absence' });
                                const html = `
                                    <div style="font-size:14px;line-height:1.6;">
                                        ${toHtml(mail.content || '')}
                                        <div style="margin-top:16px;display:flex;gap:12px;align-items:center;">
                                            ${button('参加', attendLink, '#2563eb')}
                                            ${button('不参加', absenceLink, '#dc2626')}
                                        </div>
                                    </div>
                                `;
                                const text = `${mail.content || ''}\n\n参加: ${attendLink}\n不参加: ${absenceLink}`;

                                await transporter.sendMail({
                                    from: `Tap'in出欠 <${process.env.SMTP_USER}>`,
                                    to: attendee.user.email,
                                    subject: mail.title,
                                    html,
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
