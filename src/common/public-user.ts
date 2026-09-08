import { User } from '../users/entities/user.entity';
import { Group } from '../groups/entities/group.entity';
import { GroupMember } from '../groups/entities/group-member.entity';

/** Drop device-local picker paths that iOS cannot load and that bloat snapshots. */
export function publicAssetUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('/uploads/')) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return null;
}

export function toPublicUser(
  user: User | null | undefined,
  opts: { includeContact?: boolean } = {},
) {
  if (!user) return null;
  const base = {
    id: user.id,
    displayName: user.displayName,
    photoUrl: publicAssetUrl(user.photoUrl),
    isProfileComplete: user.isProfileComplete,
  };
  if (!opts.includeContact) return base;
  return {
    ...base,
    phone: user.phone,
    instaPayAlias: user.instaPayAlias,
  };
}

export function toListMember(member: GroupMember) {
  return {
    id: member.id,
    groupId: member.groupId,
    userId: member.userId,
    pendingPhone: member.pendingPhone,
    role: member.role,
    status: member.status,
    user: toPublicUser(member.user),
  };
}

export function toListGroup(group: Group) {
  return {
    id: group.id,
    name: group.name,
    category: group.category,
    avatarUrl: publicAssetUrl(group.avatarUrl),
    members: (group.members ?? []).map(toListMember),
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  };
}

export function stripUserSecrets<T extends User>(user: T): Omit<T, 'fcmToken' | 'googleId' | 'appleId'> {
  const { fcmToken: _f, googleId: _g, appleId: _a, ...rest } = user;
  return { ...rest, photoUrl: publicAssetUrl(user.photoUrl) as T['photoUrl'] };
}
