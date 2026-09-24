import { z } from 'zod';

const revealAtSchema = z.coerce.date().refine((value) => value.getTime() > Date.now(), {
  message: 'A data de revelação deve ser futura.',
});

export const createIntentSchema = z.object({
  title: z.string().trim().min(3).max(160),
  story: z.string().trim().min(3).max(5000),
  category: z.enum([
    'SPORTS',
    'ENTERTAINMENT',
    'TECHNOLOGY',
    'EDUCATION',
    'HEALTH_WELLNESS',
    'CAREER_BUSINESS',
    'COMMUNITY_CAUSES',
    'PERSONAL_LIFE',
    'OTHER',
  ]).default('OTHER'),
  conditionType: z.enum(['SUPPORT', 'DATE', 'GUARDIANS']).default('SUPPORT'),
  supportGoal: z.number().int().min(1).max(1_000_000).optional(),
  revealAt: revealAtSchema.optional(),
  guardianIds: z.array(z.string().uuid()).max(20).optional(),
  guardianApprovalGoal: z.number().int().min(1).max(20).optional(),
  revealContent: z.string().min(1).max(10_000),
  visibility: z.enum(['PUBLIC', 'FOLLOWERS', 'PRIVATE']).default('PUBLIC'),
  status: z.enum(['DRAFT', 'PUBLISHED']).default('PUBLISHED'),
}).strict().superRefine((value, ctx) => {
  if (value.visibility === 'PRIVATE' && value.conditionType === 'SUPPORT') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['conditionType'],
      message: 'Intent privada não pode depender de apoios.',
    });
  }

  if (value.conditionType === 'SUPPORT' && value.supportGoal == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['supportGoal'],
      message: 'Informe a meta de apoios.',
    });
  }

  if (value.conditionType === 'DATE' && !value.revealAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['revealAt'],
      message: 'Informe uma data futura para revelação.',
    });
  }

  if (value.conditionType === 'GUARDIANS') {
    const uniqueGuardians = new Set(value.guardianIds ?? []);
    if (uniqueGuardians.size === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['guardianIds'],
        message: 'Informe ao menos um guardião.',
      });
    }
    if (uniqueGuardians.size !== (value.guardianIds ?? []).length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['guardianIds'],
        message: 'Não repita guardiões.',
      });
    }
    if (value.guardianApprovalGoal == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['guardianApprovalGoal'],
        message: 'Informe quantos guardiões precisam aprovar.',
      });
    } else if (value.guardianApprovalGoal > uniqueGuardians.size) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['guardianApprovalGoal'],
        message: 'A meta não pode ser maior que a quantidade de guardiões.',
      });
    }
  }
});

export const guardianApprovalSchema = z.object({
  approve: z.boolean().default(true),
}).strict();

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(120).optional(),
  bio: z.string().trim().max(500).nullable().optional(),
  avatarUrl: z.string().url().max(2048).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: 'Informe ao menos um campo para atualização.',
});
