import { describe, expect, it } from 'vitest';
import {
  getIntentShareUrl,
  getUserProfileShareUrl,
  isValidUuid,
  parseInitialLocation,
} from '../../src/utils/shareLink.js';

describe('Utilitários de Links Compartilháveis (Etapa 25A)', () => {
  const validIntentId = '11111111-2222-4333-8444-555555555555';
  const validUserId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

  describe('isValidUuid', () => {
    it('reconhece UUIDs válidos nos formatos esperados', () => {
      expect(isValidUuid(validIntentId)).toBe(true);
      expect(isValidUuid(validUserId)).toBe(true);
      expect(isValidUuid('   ' + validIntentId + '   ')).toBe(true);
    });

    it('rejeita strings vazias, valores nulos ou formatos inválidos', () => {
      expect(isValidUuid(null)).toBe(false);
      expect(isValidUuid(undefined)).toBe(false);
      expect(isValidUuid('')).toBe(false);
      expect(isValidUuid('invalid-uuid')).toBe(false);
      expect(isValidUuid('@username')).toBe(false);
      expect(isValidUuid('12345')).toBe(false);
    });
  });

  describe('parseInitialLocation com Query Params', () => {
    it('extrai intentId a partir do parâmetro ?intent=', () => {
      const parsed = parseInitialLocation(`?intent=${validIntentId}`);
      expect(parsed).toEqual({ type: 'intent', id: validIntentId });
    });

    it('extrai intentId a partir do parâmetro alternativo ?intent_id=', () => {
      const parsed = parseInitialLocation(`?intent_id=${validIntentId}`);
      expect(parsed).toEqual({ type: 'intent', id: validIntentId });
    });

    it('extrai userId a partir do parâmetro ?user=', () => {
      const parsed = parseInitialLocation(`?user=${validUserId}`);
      expect(parsed).toEqual({ type: 'user', id: validUserId });
    });

    it('extrai userId a partir do parâmetro ?profile=', () => {
      const parsed = parseInitialLocation(`?profile=${validUserId}`);
      expect(parsed).toEqual({ type: 'user', id: validUserId });
    });

    it('ignora parâmetros que não são UUIDs válidos e retorna home', () => {
      const parsed = parseInitialLocation('?intent=not-a-uuid&user=malformed');
      expect(parsed).toEqual({ type: 'home' });
    });

    it('retorna home quando nenhum parâmetro relevante está presente', () => {
      const parsed = parseInitialLocation('?utm_source=social&tab=recent');
      expect(parsed).toEqual({ type: 'home' });
    });
  });

  describe('parseInitialLocation com Path Params', () => {
    it('extrai intentId de rotas /intent/:id', () => {
      const parsed = parseInitialLocation('', `/intent/${validIntentId}`);
      expect(parsed).toEqual({ type: 'intent', id: validIntentId });
    });

    it('extrai userId de rotas /user/:id e /profile/:id', () => {
      const parsedUser = parseInitialLocation('', `/user/${validUserId}`);
      expect(parsedUser).toEqual({ type: 'user', id: validUserId });

      const parsedProfile = parseInitialLocation('', `/profile/${validUserId}`);
      expect(parsedProfile).toEqual({ type: 'user', id: validUserId });
    });

    it('retorna home quando o caminho contém ID inválido', () => {
      const parsed = parseInitialLocation('', '/intent/invalid-id');
      expect(parsed).toEqual({ type: 'home' });
    });
  });

  describe('Geração de URLs compartilháveis', () => {
    it('gera formato relativo ou absoluto consistente para Intent', () => {
      const url = getIntentShareUrl(validIntentId);
      expect(url).toContain(`intent=${validIntentId}`);
    });

    it('gera formato relativo ou absoluto consistente para Perfil de Usuário', () => {
      const url = getUserProfileShareUrl(validUserId);
      expect(url).toContain(`user=${validUserId}`);
    });
  });
});
