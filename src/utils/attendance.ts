export type AttendanceAction = 'attend' | 'absence';

export const buildAttendanceLink = ({ origin, groupId, eventId, token, action }: { origin: string; groupId: string; eventId: string; token: string; action: AttendanceAction }): string => {
    const url = new URL(`/api/events/${encodeURIComponent(groupId)}/${encodeURIComponent(eventId)}/respond/${action}`, origin);
    url.searchParams.set('token', token);
    return url.toString();
};
