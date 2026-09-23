import { Router } from 'express';
import { z } from 'zod';
import { requireAuthenticatedUser } from '../middleware/auth.js';
import {
  addPersonalContactListMember,
  createPersonalContactList,
  deletePersonalContactList,
  listPersonalContactLists,
  removePersonalContactListMember,
  renamePersonalContactList,
} from '../services/personal-contact-list-service.js';

export const personalContactListsRouter = Router();
const idSchema = z.string().uuid();
const nameSchema = z.object({ name: z.string() }).strict();
const memberSchema = z.object({ userId: idSchema }).strict();

personalContactListsRouter.use(requireAuthenticatedUser);
personalContactListsRouter.get('/', async (request, response, next) => {
  try { response.json({ data: { items: await listPersonalContactLists(request.appUser!.id) } }); } catch (error) { next(error); }
});
personalContactListsRouter.post('/', async (request, response, next) => {
  try { const { name } = nameSchema.parse(request.body); response.status(201).json({ data: await createPersonalContactList(request.appUser!.id, name) }); } catch (error) { next(error); }
});
personalContactListsRouter.patch('/:id', async (request, response, next) => {
  try { const id = idSchema.parse(request.params.id); const { name } = nameSchema.parse(request.body); response.json({ data: await renamePersonalContactList(request.appUser!.id, id, name) }); } catch (error) { next(error); }
});
personalContactListsRouter.delete('/:id', async (request, response, next) => {
  try { const id = idSchema.parse(request.params.id); response.json({ data: await deletePersonalContactList(request.appUser!.id, id) }); } catch (error) { next(error); }
});
personalContactListsRouter.post('/:id/members', async (request, response, next) => {
  try { const id = idSchema.parse(request.params.id); const { userId } = memberSchema.parse(request.body); response.status(201).json({ data: await addPersonalContactListMember(request.appUser!.id, id, userId) }); } catch (error) { next(error); }
});
personalContactListsRouter.delete('/:id/members/:userId', async (request, response, next) => {
  try { const id = idSchema.parse(request.params.id); const userId = idSchema.parse(request.params.userId); response.json({ data: await removePersonalContactListMember(request.appUser!.id, id, userId) }); } catch (error) { next(error); }
});
