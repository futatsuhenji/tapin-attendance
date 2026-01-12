// SPDX-FileCopyrightText: 2026 KATO Hayate <dev@hayatek.jp>
// SPDX-FileCopyrightText: 2026 Yu Yokoyama <25w6105e@shinshu-u.ac.jp>
// SPDX-License-Identifier: AGPL-3.0-only

import { NextResponse } from 'next/server';

import { getJwtFromCookieStore } from '@/utils/auth';
import { hasEventAccessPermission, hasEventGroupManagementPermission, hasEventManagementPermission } from '@/utils/permission';

import type { NextRequest } from 'next/server';


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


// eslint-disable-next-line sonarjs/cognitive-complexity
export async function proxy(request: NextRequest) {
    const jwt = await getJwtFromCookieStore();
    const reader = new PathSegmentReader(request.nextUrl.pathname);
    // eslint-disable-next-line sonarjs/no-small-switch
    switch (reader.next()) {
        case 'api': {
            // eslint-disable-next-line sonarjs/no-small-switch
            switch (reader.next()) {
                case 'events': {
                    // Peek next three segments: /api/events/:groupId/:eventId/:action
                    const seg1 = reader.next();
                    const seg2 = reader.next();
                    const seg3 = reader.next();

                    // allow public respond endpoints without auth: /api/events/:groupId/:eventId/respond/:decision
                    if (seg3 === 'respond') {
                        return NextResponse.next();
                    }

                    // otherwise require authentication for event-related routes
                    if (!jwt) {
                        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
                    }

                    if (!seg2) {
                        return NextResponse.next();
                    }

                    const _groupId = seg1!;
                    const eventId = seg2!;
                    if (!(await hasEventAccessPermission(jwt.user.id, eventId))) {
                        console.log('Forbidden access to event:', eventId, 'by user:', jwt.user.id);
                        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
                    }
                    // eslint-disable-next-line sonarjs/no-small-switch
                    switch (seg3) {
                        case 'manage': {
                            if (!(await hasEventManagementPermission(jwt.user.id, eventId))) {
                                console.log('Forbidden management access to event:', eventId, 'by user:', jwt.user.id);
                                return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
                            }
                            break;
                        }
                    }
                    break;
                }
                case 'groups': {
                    if (!jwt) {
                        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
                    }

                    // /api/groups/:groupId/...
                    const groupId = reader.next();
                    if (!groupId) {
                        return NextResponse.next();
                    }

                    if (!(await hasEventGroupManagementPermission(jwt.user.id, groupId))) {
                        console.log('Forbidden access to group:', groupId, 'by user:', jwt.user.id);
                        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
                    }

                    break;
                }
            }
            break;
        }
    }
    return NextResponse.next();
}


export const config = {
    matcher: [
        '/api/:path*',
    ],
};
