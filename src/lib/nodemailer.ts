import SMTPTransport from 'nodemailer/lib/smtp-transport';
import { createTransport } from 'nodemailer';

import type { Transporter } from 'nodemailer';


const globalForNodemailer = globalThis as unknown as { transporter: Transporter };


export const transporter =
    globalForNodemailer.transporter ||
    createTransport({ // eslint-disable-line sonarjs/no-clear-text-protocols
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: true,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
        },
    } as SMTPTransport.Options);


if (process.env.NODE_ENV !== 'production') {
    globalForNodemailer.transporter = transporter;
}
