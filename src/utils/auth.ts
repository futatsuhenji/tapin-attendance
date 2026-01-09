import { randomUUID } from 'node:crypto';

import { sha256 } from 'hono/utils/crypto';
import { SignJWT, jwtVerify } from 'jose';

import { redis } from '@/lib/redis';
import { JWTPayload } from 'hono/utils/jwt/types';


/**
 * メール認証トークンを生成し認証DBに保存する。
 *
 * @param email - 認証するメールアドレス
 * @returns メール認証トークン
 */
export async function getEmailVerificationToken(email: string): Promise<string> {
    const token = randomUUID();
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
    /** メールアドレス */
    email: string;
}


/** JWTペイロード */
type JwtPayload = JWTPayload & {
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
    const now: number = Date.now();
    const expiresAt: Date = new Date(now + 1000 * 60 * 60 * 24 * 3);
    const payload = {
        exp: Math.floor(expiresAt.getTime() / 1000),
        iat: Math.floor(now / 1000),
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
