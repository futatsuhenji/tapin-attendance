import SMTPTransport from 'nodemailer/lib/smtp-transport';
import { createTransport } from 'nodemailer';

import { getEnvironmentValueOrThrow } from '@/utils/environ';

import type { Transporter } from 'nodemailer';


export type MailTransportConfig = {
    host: string;
    port: number;
    secure?: boolean;
    auth: {
        user: string;
        pass: string;
    };
};

const globalForNodemailer = globalThis as unknown as { transporter?: Transporter };


async function getDefaultTransportConfig(): Promise<MailTransportConfig> {
    return {
        host: await getEnvironmentValueOrThrow('SMTP_HOST'),
        port: Number(await getEnvironmentValueOrThrow('SMTP_PORT')),
        secure: true,
        auth: {
            user: await getEnvironmentValueOrThrow('SMTP_USER'),
            pass: await getEnvironmentValueOrThrow('SMTP_PASSWORD'),
        },
    };
}

function toTransportOptions(config: MailTransportConfig): SMTPTransport.Options {
    return {
        ...config,
        secure: config.secure ?? true,
    } satisfies SMTPTransport.Options;
}

export async function getMailTransporter(config?: MailTransportConfig): Promise<Transporter> {
    if (!config) {
        if (!globalForNodemailer.transporter) {
            const transporter = createTransport(toTransportOptions(await getDefaultTransportConfig())); // eslint-disable-line sonarjs/no-clear-text-protocols
            globalForNodemailer.transporter = transporter;
        }

        return globalForNodemailer.transporter;
    }

    return createTransport(toTransportOptions(config)); // eslint-disable-line sonarjs/no-clear-text-protocols
}

export async function getDefaultMailFrom(): Promise<string> {
    const user = await getEnvironmentValueOrThrow('SMTP_USER');
    return `Tap'in出欠 <${user}>`;
}
