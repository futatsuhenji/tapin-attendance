// SPDX-FileCopyrightText: 2026 KATO Hayate <dev@hayatek.jp>
// SPDX-License-Identifier: AGPL-3.0-only

import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import { getMailTransporter } from '@/lib/nodemailer';
import { getEmailVerificationToken, validateEmailVerificationToken, issueJwt } from '@/utils/auth';
import { getPrismaClient } from '@/lib/prisma';
import { getEnvironmentValueOrThrow } from '@/utils/environ';


const app = new Hono()
    .post('/request',
        zValidator('json', z.object({ email: z.email(), redirectUrl: z.string().optional() })),
        async (c) => {
            const transporter = await getMailTransporter();
            const { email, redirectUrl } = c.req.valid('json');
            const token = await getEmailVerificationToken(email);
            await transporter.sendMail({
                from: `Tap'in出欠 <${await getEnvironmentValueOrThrow('SMTP_USER')}>`,
                to: email,
                subject: '【Tap\'in出欠】メールアドレス認証',
                html: `
                    <!DOCTYPE html>
                    <html lang="ja">
                        <body>
                            <p>Tap'in出欠をご利用いただき、ありがとうございます。</p>
                            <p>以下のリンクをクリックして、メールアドレスの認証を完了してください。</p>
                            <p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/auth/email/verify?token=${token}${redirectUrl ? `&redirectUrl=${encodeURIComponent(redirectUrl)}` : ''}">メールアドレスを認証する</a></p>
                            <p>このリンクの有効期限は5分間です。</p>
                            <p>もしこのメールに心当たりがない場合は、破棄してください。</p>
                        </body>
                    </html>
                `,
            });
            return c.json({ message: 'Verification email sent' }, 201);
        },
    )
    .get('/verify',
        zValidator('query', z.object({ token: z.string(), redirectUrl: z.string().optional() })),
        async (c) => {
            const prisma = await getPrismaClient();
            const { token, redirectUrl } = c.req.valid('query');
            let user;
            try {
                const email = await validateEmailVerificationToken(token);
                const defaultName = email.split('@')[0] || 'ユーザー';
                user = await prisma.user.upsert({
                    where: { email },
                    update: {},
                    create: { email, name: defaultName },
                    select: { id: true, email: true },
                });
            } catch (e) {
                console.error(e);
                return c.json({ message: 'Invalid or expired token' }, 400);
            }
            if (user) {
                const [jwt, payload] = await issueJwt({ id: user.id, email: user.email });
                setCookie(c, 'auth_token', jwt, {
                    expires: new Date(payload.exp! * 1000),
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'Strict',
                    priority: 'High',
                });
                return c.redirect(redirectUrl ?? '/mypage');
            } else {
                return c.json({ message: 'Invalid or expired token' }, 400);
            }
        },
    );

export default app;
