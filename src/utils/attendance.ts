// SPDX-FileCopyrightText: 2026 KATO Hayate <dev@hayatek.jp>
// SPDX-License-Identifier: AGPL-3.0-only

export type AttendanceAction = 'attend' | 'absence';

export const buildAttendanceLink = ({ origin, groupId, eventId, token, action }: { origin: string; groupId: string; eventId: string; token: string; action: AttendanceAction }): string => {
    const url = new URL(`/api/events/${encodeURIComponent(groupId)}/${encodeURIComponent(eventId)}/respond/${action}`, origin);
    url.searchParams.set('token', token);
    return url.toString();
};
