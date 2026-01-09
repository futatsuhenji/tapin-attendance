import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { getJwtFromCookieStore } from '@/utils/auth';

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
                    if (!jwt) {
                        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
                    }
                    const _groupId = reader.next()!;
                    const eventId = reader.next()!;
                    const user = await prisma.user.findUniqueOrThrow({
                        where: { email: jwt.user.email },
                        select: { id: true },
                    });
                    if (!(await prisma.attendance.findUnique({
                        where: { eventId_userId: { eventId, userId: user.id } },
                        select: { userId: true },
                    }))) {
                        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
                    }
                    // eslint-disable-next-line sonarjs/no-small-switch
                    switch (reader.next()) {
                        case 'manage': {
                            if (!(await prisma.eventAdministrator.findUnique({
                                where: { eventId_userId: { eventId, userId: user.id } },
                                select: { userId: true },
                            }))) {
                                return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
                            }
                            break;
                        }
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
