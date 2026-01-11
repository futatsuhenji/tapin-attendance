import { prisma } from '@/lib/prisma';


/**
 * ユーザーが特定のイベントにアクセス権を持っているか確認する。
 *
 * @param userId - 検証するユーザーのID
 * @param eventId - 検証するイベントのID
 * @returns アクセス権を持っていれば true、そうでなければ false
 */
export async function hasEventAccessPermission(userId: string, eventId: string): Promise<boolean> {
    const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { ownerId: true, groupId: true },
    });

    if (event?.ownerId === userId) return true;

    if (event?.groupId && (await hasEventGroupManagementPermission(userId, event.groupId))) return true;

    const admin = await prisma.eventAdministrator.findUnique({
        where: { eventId_userId: { eventId, userId } },
        select: { userId: true },
    });
    if (admin) return true;

    const attendance = await prisma.attendance.findUnique({
        where: { eventId_userId: { eventId, userId } },
        select: { userId: true },
    });
    return !!attendance;
}


/**
 * ユーザーが特定のイベントの管理権限を持っているか確認する。
 *
 * @param userId - 検証するユーザーのID
 * @param eventId - 検証するイベントのID
 * @returns 権限を持っていれば true、そうでなければ false
 */
export async function hasEventManagementPermission(userId: string, eventId: string): Promise<boolean> {
    const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { ownerId: true, groupId: true },
    });
    if (event?.ownerId === userId) {
        return true;
    }
    if (event?.groupId && (await hasEventGroupManagementPermission(userId, event.groupId))) {
        return true;
    }
    const admin = await prisma.eventAdministrator.findUnique({
        where: { eventId_userId: { eventId, userId } },
        select: { userId: true },
    });
    return !!admin;
}


/** * ユーザーが特定のイベントグループの管理権限を持っているか確認する。
 *
 * @param userId - 検証するユーザーのID
 * @param groupId - 検証するイベントグループのID
 * @returns 権限を持っていれば true、そうでなければ false
 */
export async function hasEventGroupManagementPermission(userId: string, groupId: string): Promise<boolean> {
    const group = await prisma.eventGroup.findUnique({
        where: { id: groupId },
        select: { ownerId: true },
    });
    if (group?.ownerId === userId) {
        return true;
    }
    const admin = await prisma.eventGroupAdministrator.findUnique({
        where: { groupId_userId: { groupId, userId } },
        select: { userId: true },
    });
    return !!admin;
}
