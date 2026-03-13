// SPDX-FileCopyrightText: 2026 KATO Hayate <dev@hayatek.jp>
// SPDX-FileCopyrightText: 2026 Yu Yokoyama <25w6105e@shinshu-u.ac.jp>
// SPDX-License-Identifier: AGPL-3.0-only

import { NextResponse } from 'next/server';

import { issueJwt, verifyJwt } from '@/utils/auth';
import { hasEventAccessPermission, hasEventGroupManagementPermission, hasEventManagementPermission } from '@/utils/permission';

import type { NextRequest } from 'next/server';
import type { JWTPayload } from 'hono/utils/jwt/types';


type JwtPayload = JWTPayload & {
    user?: {
        id: string;
        email: string;
    };
};

type JwtUser = {
    id: string;
    email: string;
};


class PathSegmentReader {
    private segments: string[];
    private index: number;

    constructor(path: string) {
        this.segments = path.split('/').slice(1);
        this.index = 0;
    }

    public next(): string | null {
        return this.index < this.segments.length ? this.segments[this.index++] : null;
    }
}

async function getJwtFromRequest(request: NextRequest): Promise<JwtPayload | null> {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) return null;

    try {
        return await verifyJwt(token);
    } catch (e) {
        console.error('JWT verification failed in proxy:', e);
        return null;
    }
}

async function attachRefreshedToken(response: NextResponse, jwt: JwtPayload | null): Promise<NextResponse> {
    if (!jwt?.user?.id || !jwt.user.email) return response;

    const [token, payload] = await issueJwt({ id: jwt.user.id, email: jwt.user.email });
    response.cookies.set('auth_token', token, {
        expires: new Date(payload.exp! * 1000),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        priority: 'high',
        path: '/',
    });

    return response;
}

function getJwtUser(jwt: JwtPayload | null): JwtUser | null {
    if (!jwt?.user?.id || !jwt.user.email) return null;
    return jwt.user;
}


// eslint-disable-next-line sonarjs/cognitive-complexity
export async function proxy(request: NextRequest) {
    const jwt = await getJwtFromRequest(request);
    const jwtUser = getJwtUser(jwt);
    const reader = new PathSegmentReader(request.nextUrl.pathname);

    // If already authenticated, the login page is unnecessary.
    if (request.nextUrl.pathname === '/login' && jwtUser) {
        return await attachRefreshedToken(NextResponse.redirect(new URL('/mypage', request.url)), jwt);
    }

    // eslint-disable-next-line sonarjs/no-small-switch
    switch (reader.next()) {
        case 'api': {

            switch (reader.next()) {
                case 'events': {
                    // Peek next segments: /api/events/:groupId/:eventId/:action/:subAction
                    const seg1 = reader.next();
                    const seg2 = reader.next();
                    const seg3 = reader.next();
                    const seg4 = reader.next();

                    // allow public respond endpoints without auth: /api/events/:groupId/:eventId/respond/:decision
                    if (['respond', 'open'].includes(seg3!)) {
                        return await attachRefreshedToken(NextResponse.next(), jwt);
                    }

                    // allow public registration endpoints without auth.
                    // /api/events/:groupId/:eventId/register/request
                    // /api/events/:groupId/:eventId/register/complete
                    if (seg3 === 'register' && ['request', 'complete'].includes(seg4 ?? '')) {
                        return await attachRefreshedToken(NextResponse.next(), jwt);
                    }

                    // otherwise require authentication for event-related routes
                    if (!jwtUser) {
                        return await attachRefreshedToken(NextResponse.json({ message: 'Unauthorized' }, { status: 401 }), jwt);
                    }

                    if (!seg2) {
                        return await attachRefreshedToken(NextResponse.next(), jwt);
                    }

                    const _groupId = seg1!;
                    const eventId = seg2!;
                    if (!(await hasEventAccessPermission(jwtUser.id, eventId))) {
                        console.log('Forbidden access to event:', eventId, 'by user:', jwtUser.id);
                        return await attachRefreshedToken(NextResponse.json({ message: 'Forbidden' }, { status: 403 }), jwt);
                    }
                    // eslint-disable-next-line sonarjs/no-small-switch
                    switch (seg3) {
                        case 'manage': {
                            if (!(await hasEventManagementPermission(jwtUser.id, eventId))) {
                                console.log('Forbidden management access to event:', eventId, 'by user:', jwtUser.id);
                                return await attachRefreshedToken(NextResponse.json({ message: 'Forbidden' }, { status: 403 }), jwt);
                            }
                            break;
                        }
                    }
                    break;
                }
                case 'groups': {
                    if (!jwtUser) {
                        return await attachRefreshedToken(NextResponse.json({ message: 'Unauthorized' }, { status: 401 }), jwt);
                    }

                    // /api/groups/:groupId/...
                    const groupId = reader.next();
                    if (!groupId) {
                        return await attachRefreshedToken(NextResponse.next(), jwt);
                    }

                    if (!(await hasEventGroupManagementPermission(jwtUser.id, groupId))) {
                        console.log('Forbidden access to group:', groupId, 'by user:', jwtUser.id);
                        return await attachRefreshedToken(NextResponse.json({ message: 'Forbidden' }, { status: 403 }), jwt);
                    }

                    break;
                }
            }
            break;
        }
    }
    return await attachRefreshedToken(NextResponse.next(), jwt);
}


export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
