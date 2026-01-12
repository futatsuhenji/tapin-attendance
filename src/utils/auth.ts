// SPDX-FileCopyrightText: 2026 KATO Hayate <dev@hayatek.jp>
// SPDX-License-Identifier: AGPL-3.0-only

import { randomUUID } from 'node:crypto';

import { getCookie } from 'hono/cookie';
import { sha256 } from 'hono/utils/crypto';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

import { getRedisClient } from '@/lib/redis';

import type { Context } from 'hono';
import type { JWTPayload } from 'hono/utils/jwt/types';


/**
 * メール認証トークンを生成し認証DBに保存する。
 *
 * @param email - 認証するメールアドレス
 * @returns メール認証トークン
 */
export async function getEmailVerificationToken(email: string): Promise<string> {
    const token = randomUUID();
    const redis = await getRedisClient();
    await redis.set(`email-verification:${await sha256(token)}`, email, { expiration: { type: 'EX', value: 60 * 5 } });
    return token;
}


/**
 * メール認証トークンを検証しメールアドレスを返す。
 *
 * @param token - メール認証トークン
 * @returns トークンに紐づくメールアドレス
 */
export async function validateEmailVerificationToken(token: string): Promise<string> {
    const lua = `
        local val = redis.call('GET', KEYS[1])
        if val then
            redis.call('DEL', KEYS[1])
        end
        return val
    `;
    const redis = await getRedisClient();
    const result = await redis.eval(lua, { keys: [`email-verification:${await sha256(token)}`] });
    if (typeof result === 'string') {
        return result;
    } else {
        // eslint-disable-next-line unicorn/prefer-type-error
        throw new Error('Email verification failed');
    }
}


/**
 * JWTの内容。
 */
interface JwtUserContent {
    /** ユーザーID */
    id: string;
    /** メールアドレス */
    email: string;
}


/** JWTペイロード */
type JwtPayload = JWTPayload & { // NOTE: J['exp']および['iat']を `Date` に変換する場合は1000倍する必要がある
    user: JwtUserContent,
};


/**
 * JWTを発行する。
 *
 * @param payload - JWTペイロード
 * @returns JWTとそのペイロード
 */
export async function issueJwt(content: JwtUserContent): Promise<[string, JwtPayload]> {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-jwt-secret');
    const now = new Date(Date.now());
    const expiresAt: Date = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 3);
    const payload = {
        user: content,
    } as const satisfies JwtPayload;
    return [
        await new SignJWT(payload)
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt(now)
            .setExpirationTime(expiresAt)
            .sign(secret),
        payload,
    ];
}


/**
 * JWTを検証する。
 *
 * @param token - JWT
 * @returns JWTペイロード
 */
export async function verifyJwt(token: string): Promise<JwtPayload> {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-jwt-secret');
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as JwtPayload;
}


/**
 * HonoコンテキストからJWTペイロードを取得する。
 *
 * @param c - Honoコンテキスト
 * @returns JWTペイロード、またはnull（JWTが存在しないか検証に失敗した場合）
 */
export async function getJwtFromContext(c: Context): Promise<JwtPayload | null> {
    const token = getCookie(c, 'auth_token');
    if (token) {
        try {
            const payload = await verifyJwt(token);
            return payload;
        } catch (e) {
            console.error('JWT verification failed:', e);
            return null;
        }
    } else {
        return null;
    }
}


/**
 * Next.jsのCookieストアからJWTペイロードを取得する。
 *
 * @returns JWTペイロード、またはnull（JWTが存在しないか検証に失敗した場合）
 */
export async function getJwtFromCookieStore(): Promise<JwtPayload | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (token) {
        try {
            const payload = await verifyJwt(token);
            return payload;
        } catch (e) {
            console.error('JWT verification failed:', e);
            return null;
        }
    } else {
        return null;
    }
}
