import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../errors.js';

const memberSelection = {
  id: true,
  username: true,
  displayName: true,
  bio: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;

const listSelection = {
  id: true,
  name: true,
  createdAt: true,
  updatedAt: true,
  members: {
    where: { user: { status: 'ACTIVE' } },
    orderBy: { createdAt: 'asc' },
    select: { user: { select: memberSelection }, createdAt: true },
  },
} satisfies Prisma.PersonalContactListSelect;

function cleanName(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function nameKey(value: string) {
  return cleanName(value).toLocaleLowerCase('en-US');
}

function presentList(list: Prisma.PersonalContactListGetPayload<{ select: typeof listSelection }>) {
  return {
    id: list.id,
    name: list.name,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
    members: list.members.map((member) => member.user),
  };
}

async function ownList(ownerId: string, listId: string) {
  const list = await prisma.personalContactList.findFirst({ where: { id: listId, ownerId }, select: listSelection });
  if (!list) throw new AppError(404, 'LIST_NOT_FOUND', 'Lista não encontrada.');
  return list;
}

export async function listPersonalContactLists(ownerId: string) {
  const lists = await prisma.personalContactList.findMany({ where: { ownerId }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], select: listSelection });
  return lists.map(presentList);
}

export async function createPersonalContactList(ownerId: string, rawName: string) {
  const name = cleanName(rawName);
  if (name.length < 1 || name.length > 80) throw new AppError(400, 'INVALID_LIST_NAME', 'O nome da lista deve ter entre 1 e 80 caracteres.');
  const list = await prisma.personalContactList.create({ data: { ownerId, name, nameKey: nameKey(name) }, select: listSelection });
  return presentList(list);
}

export async function renamePersonalContactList(ownerId: string, listId: string, rawName: string) {
  await ownList(ownerId, listId);
  const name = cleanName(rawName);
  if (name.length < 1 || name.length > 80) throw new AppError(400, 'INVALID_LIST_NAME', 'O nome da lista deve ter entre 1 e 80 caracteres.');
  const list = await prisma.personalContactList.update({ where: { id: listId }, data: { name, nameKey: nameKey(name) }, select: listSelection });
  return presentList(list);
}

export async function deletePersonalContactList(ownerId: string, listId: string) {
  await ownList(ownerId, listId);
  await prisma.personalContactListMember.deleteMany({ where: { listId } });
  await prisma.personalContactList.delete({ where: { id: listId } });
  return { deleted: true };
}

export async function addPersonalContactListMember(ownerId: string, listId: string, userId: string) {
  await ownList(ownerId, listId);
  if (ownerId === userId) throw new AppError(400, 'INVALID_LIST_MEMBER', 'O proprietário não pode ser membro da própria lista.');
  const user = await prisma.user.findFirst({ where: { id: userId, status: 'ACTIVE' }, select: { id: true } });
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Pessoa não encontrada.');
  await prisma.personalContactListMember.createMany({ data: [{ listId, userId }], skipDuplicates: true });
  return presentList(await ownList(ownerId, listId));
}

export async function removePersonalContactListMember(ownerId: string, listId: string, userId: string) {
  await ownList(ownerId, listId);
  await prisma.personalContactListMember.deleteMany({ where: { listId, userId } });
  return presentList(await ownList(ownerId, listId));
}

export async function resolvePersonalContactListMemberIds(ownerId: string, listIds: string[]) {
  if (listIds.length === 0) return [];
  const memberships = await prisma.personalContactListMember.findMany({
    where: { list: { ownerId, id: { in: listIds } }, user: { status: 'ACTIVE' } },
    select: { userId: true },
  });
  return [...new Set(memberships.map((item) => item.userId))];
}
