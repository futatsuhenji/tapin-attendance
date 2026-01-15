import SMTPTransport from 'nodemailer/lib/smtp-transport';
import { createTransport } from 'nodemailer';

import { getEnvironmentValueOrThrow } from '@/utils/environ';

import type { Transporter } from 'nodemailer';


const globalForNodemailer = globalThis as unknown as { transporter: Transporter };


export async function getMailTransporter(): Promise<Transporter> {
    if (!globalForNodemailer.transporter) {
        const transporter = createTransport({ // eslint-disable-line sonarjs/no-clear-text-protocols
            host: await getEnvironmentValueOrThrow('SMTP_HOST'),
            port: Number(await getEnvironmentValueOrThrow('SMTP_PORT')),
            secure: true,
            auth: {
                user: await getEnvironmentValueOrThrow('SMTP_USER'),
                pass: await getEnvironmentValueOrThrow('SMTP_PASSWORD'),
            },
        } as SMTPTransport.Options);

        globalForNodemailer.transporter = transporter;
    }

    return globalForNodemailer.transporter;
}
