import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import { transporter } from '@/lib/nodemailer';
import { getEmailVerificationToken, validateEmailVerificationToken, issueJwt } from '@/utils/auth';


const app = new Hono()
    .post('/request',
        zValidator('json', z.object({ email: z.email(), redirectUrl: z.string().optional() })),
        async (c) => {
            const { email, redirectUrl } = c.req.valid('json');
            const token = await getEmailVerificationToken(email);
            await transporter.sendMail({
                from: `Tap'in出欠 <${process.env.SMTP_USER}>`,
                to: email,
                subject: '【Tap\'in出欠】メールアドレス認証',
                html: `
                    <!DOCTYPE html>
                    <html lang="ja">
                        <body>
                            <p>Tap'in出欠をご利用いただき、ありがとうございます。</p>
                            <p>以下のリンクをクリックして、メールアドレスの認証を完了してください。</p>
                            <p><a href="http${process.env.NODE_ENV === 'production' ? 's' : ''}://${process.env.NEXT_PUBLIC_BASE_URL ?? 'localhost:3000'}/api/auth/email/verify?token=${token}${redirectUrl ? `&redirectUrl=${encodeURIComponent(redirectUrl)}` : ''}">メールアドレスを認証する</a></p>
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
            const { token, redirectUrl } = c.req.valid('query');
            let email;
            try {
                email = await validateEmailVerificationToken(token);
            } catch (e) {
                console.error(e);
                return c.json({ message: 'Invalid or expired token' }, 400);
            }
            if (email) {
                const [jwt, payload] = await issueJwt({ email });
                setCookie(c, 'auth_token', jwt, {
                    expires: new Date(payload.exp! * 1000),
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'Strict',
                    priority: 'High',
                });
                return c.redirect(redirectUrl ?? '/');
            } else {
                return c.json({ message: 'Invalid or expired token' }, 400);
            }
        },
    );

export default app;
