import { useEffect, useMemo, useState } from 'react';
import { ListPlus, Pencil, Plus, Trash2, UserPlus, X } from 'lucide-react';
import {
  addPersonalContactListMember,
  createPersonalContactList,
  deletePersonalContactList,
  listPersonalContactLists,
  removePersonalContactListMember,
  renamePersonalContactList,
  searchUsers,
  type ApiPersonalContactList,
  type ApiUserSearchResult,
  IntentApiError,
} from '../services/intentApi';

interface PersonalContactListsPanelProps {
  selectedUsers: ApiUserSearchResult[];
  onSelectionChange: (users: ApiUserSearchResult[]) => void;
  maxSelected?: number;
}

export function PersonalContactListsPanel({ selectedUsers, onSelectionChange, maxSelected = 20 }: PersonalContactListsPanelProps) {
  const [lists, setLists] = useState<ApiPersonalContactList[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState<ApiUserSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const activeList = useMemo(() => lists.find((list) => list.id === activeId) ?? null, [lists, activeId]);
  const selected = new Set(selectedUsers.map((user) => user.id));

  useEffect(() => { void refresh(); }, []);

  async function refresh() {
    try { setLoading(true); setLists(await listPersonalContactLists()); } catch (caught) { setError(caught instanceof IntentApiError ? caught.message : 'Não foi possível carregar suas listas.'); } finally { setLoading(false); }
  }

  function replaceList(updated: ApiPersonalContactList) { setLists((current) => current.map((list) => list.id === updated.id ? updated : list)); }

  async function createList() {
    if (!name.trim()) return;
    try { setBusy(true); const created = await createPersonalContactList(name); setLists((current) => [created, ...current]); setActiveId(created.id); setName(''); } catch (caught) { setError(caught instanceof IntentApiError ? caught.message : 'Não foi possível criar a lista.'); } finally { setBusy(false); }
  }

  async function renameList() {
    if (!activeList || !name.trim()) return;
    try { setBusy(true); replaceList(await renamePersonalContactList(activeList.id, name)); setName(''); } catch (caught) { setError(caught instanceof IntentApiError ? caught.message : 'Não foi possível renomear a lista.'); } finally { setBusy(false); }
  }

  async function removeList() {
    if (!activeList) return;
    try { setBusy(true); await deletePersonalContactList(activeList.id); setLists((current) => current.filter((list) => list.id !== activeList.id)); setActiveId(null); } catch (caught) { setError(caught instanceof IntentApiError ? caught.message : 'Não foi possível excluir a lista.'); } finally { setBusy(false); }
  }

  async function findMembers() {
    if (memberQuery.trim().length < 2) return;
    try { setError(''); setMemberResults(await searchUsers(memberQuery)); } catch (caught) { setError(caught instanceof IntentApiError ? caught.message : 'Não foi possível buscar pessoas.'); }
  }

  async function addMember(user: ApiUserSearchResult) {
    if (!activeList || activeList.members.some((member) => member.id === user.id)) return;
    try { setBusy(true); replaceList(await addPersonalContactListMember(activeList.id, user.id)); setMemberResults((current) => current.filter((item) => item.id !== user.id)); } catch (caught) { setError(caught instanceof IntentApiError ? caught.message : 'Não foi possível adicionar a pessoa.'); } finally { setBusy(false); }
  }

  async function removeMember(userId: string) {
    if (!activeList) return;
    try { setBusy(true); replaceList(await removePersonalContactListMember(activeList.id, userId)); } catch (caught) { setError(caught instanceof IntentApiError ? caught.message : 'Não foi possível remover a pessoa.'); } finally { setBusy(false); }
  }

  function toggleList(list: ApiPersonalContactList) {
    const users = [...new Map([...selectedUsers, ...list.members].map((user) => [user.id, user])).values()];
    if (users.length > maxSelected) { setError(`Selecione no máximo ${maxSelected} guardiões.`); return; }
    onSelectionChange(users);
  }

  function toggleMember(user: ApiUserSearchResult) {
    if (selected.has(user.id)) onSelectionChange(selectedUsers.filter((item) => item.id !== user.id));
    else if (selectedUsers.length < maxSelected) onSelectionChange([...selectedUsers, user]);
    else setError(`Selecione no máximo ${maxSelected} guardiões.`);
  }

  if (loading) return <p className="text-xs text-[#666]">Carregando listas pessoais...</p>;
  return <div className="rounded-xl border border-[#d2d1ff] bg-[#f7f6fc] p-4 space-y-3">
    <div className="flex items-center justify-between"><p className="text-xs font-bold text-[#000666] flex items-center gap-2"><ListPlus className="w-4 h-4" />Listas pessoais</p><span className="text-[11px] text-[#666]">Atalhos para este acontecimento</span></div>
    <div className="flex gap-2"><input value={name} onChange={(event) => setName(event.target.value)} placeholder={activeList ? 'Novo nome' : 'Nome da lista'} className="min-w-0 flex-1 bg-white border border-[#c6c5d4] rounded-lg px-3 py-2 text-xs" /><button type="button" disabled={busy || !name.trim()} onClick={() => void (activeList ? renameList() : createList())} className="px-3 py-2 rounded-lg bg-[#000666] text-white text-xs font-bold">{activeList ? <Pencil className="w-3 h-3" /> : <Plus className="w-3 h-3" />}</button></div>
    {lists.length === 0 ? <p className="text-xs text-[#666]">Crie sua primeira lista para reutilizar pessoas.</p> : <div className="flex flex-wrap gap-2">{lists.map((list) => <button key={list.id} type="button" onClick={() => { setActiveId(list.id); setName(list.name); }} className={`px-3 py-2 rounded-lg text-xs font-bold border ${activeId === list.id ? 'bg-[#000666] text-white border-[#000666]' : 'bg-white border-[#e4e2de] text-[#454652]'}`}>{list.name} ({list.members.length})</button>)}</div>}
    {activeList && <div className="space-y-3 border-t border-[#d2d1ff] pt-3"><div className="flex items-center justify-between"><span className="text-xs font-bold">{activeList.name}</span><button type="button" onClick={() => void removeList()} disabled={busy} className="text-[#8c1d18]" aria-label="Excluir lista"><Trash2 className="w-4 h-4" /></button></div><div className="flex gap-2"><input value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void findMembers(); } }} placeholder="Buscar pessoa" className="min-w-0 flex-1 bg-white border border-[#c6c5d4] rounded-lg px-3 py-2 text-xs" /><button type="button" onClick={() => void findMembers()} className="px-3 py-2 rounded-lg border border-[#000666] text-[#000666] text-xs font-bold"><UserPlus className="w-3 h-3" /></button></div>{memberResults.map((user) => <button key={user.id} type="button" onClick={() => void addMember(user)} className="w-full text-left bg-white rounded-lg px-3 py-2 text-xs">{user.displayName} <span className="text-[#666]">@{user.username}</span></button>)}<div className="space-y-1">{activeList.members.map((member) => <div key={member.id} className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-2"><button type="button" onClick={() => toggleMember(member)} className={`text-left ${selected.has(member.id) ? 'font-bold text-[#000666]' : ''}`}>{selected.has(member.id) ? '✓ ' : ''}{member.displayName} <span className="text-[#666]">@{member.username}</span></button><button type="button" onClick={() => void removeMember(member.id)} aria-label={`Remover ${member.displayName}`}><X className="w-3 h-3 text-[#8c1d18]" /></button></div>)}</div><button type="button" onClick={() => toggleList(activeList)} className="w-full rounded-lg bg-white border border-[#000666] text-[#000666] py-2 text-xs font-bold">Adicionar lista à seleção</button></div>}
    {error && <p role="alert" className="text-xs text-[#8c1d18]">{error}</p>}
  </div>;
}
