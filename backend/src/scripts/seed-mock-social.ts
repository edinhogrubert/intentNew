import { randomUUID } from 'node:crypto';
import { resolveDatabaseUrl } from '../lib/db-url.js';

resolveDatabaseUrl();

import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';
import { sealReveal, revealAssociatedData } from '../domain/reveal-crypto.js';

interface SeedIntentDef {
  creatorUsername: string;
  title: string;
  story: string;
  category: string;
  conditionType: 'SUPPORT' | 'TIME' | 'GUARDIAN';
  supportGoal: number;
  revealContent: string;
  supporters: string[]; // usernames
  comments: Array<{ authorUsername: string; text: string }>;
  reactions: Array<{ username: string; type: 'LIKE' | 'LOVE' | 'CELEBRATE' }>;
}

async function main() {
  console.log('Iniciando povoamento de dados reais para os usuários existentes...');

  const users = await prisma.user.findMany();
  const userMap = new Map(users.map((u) => [u.username, u]));

  console.log(`Encontrados ${users.length} usuários:`, Array.from(userMap.keys()));

  // 1. Atualizar Bios / Perfis se vazios
  const profileUpdates: Record<string, { bio: string; displayName: string }> = {
    miranha: { bio: 'Amigo da vizinhança. Defendendo causas justas e compartilhando arte independente.', displayName: 'Miranha' },
    batima: { bio: 'Vigilante da transparência e inovação. A noite é apenas o começo.', displayName: 'Batima' },
    snoop: { bio: 'Música, vibe positiva, culinária e lifestyle sustentável.', displayName: 'Snoop' },
    will: { bio: 'Engenheiro de software, corredor amador e mentor de tecnologia.', displayName: 'Will' },
    henry: { bio: 'Arquiteto de soluções distribuídas e autor técnico.', displayName: 'Henry' },
    willian_santos: { bio: 'Empreendedor social, maker e entusiasta de robótica.', displayName: 'Willian Santos' },
    edinho_grubert: { bio: 'Criador de acontecimentos e entusiasta do Intent OS.', displayName: 'Edinho Grubert' },
  };

  for (const [username, info] of Object.entries(profileUpdates)) {
    const u = userMap.get(username);
    if (u) {
      await prisma.user.update({
        where: { id: u.id },
        data: {
          displayName: info.displayName,
          bio: u.bio || info.bio,
        },
      });
    }
  }

  // 2. Conectar Seguidores (Follows mútuos para o feed "Seguindo" ficar rico)
  console.log('Criando conexões de seguidores...');
  const followPairs: Array<[string, string]> = [
    ['edinho_grubert', 'miranha'],
    ['edinho_grubert', 'batima'],
    ['edinho_grubert', 'snoop'],
    ['edinho_grubert', 'will'],
    ['edinho_grubert', 'henry'],
    ['edinho_grubert', 'willian_santos'],
    ['miranha', 'batima'],
    ['miranha', 'edinho_grubert'],
    ['batima', 'miranha'],
    ['batima', 'will'],
    ['snoop', 'miranha'],
    ['snoop', 'edinho_grubert'],
    ['will', 'edinho_grubert'],
    ['will', 'henry'],
    ['henry', 'willian_santos'],
    ['willian_santos', 'will'],
  ];

  for (const [followerUser, followingUser] of followPairs) {
    const follower = userMap.get(followerUser);
    const following = userMap.get(followingUser);
    if (follower && following && follower.id !== following.id) {
      await prisma.follow.upsert({
        where: {
          followerId_followingId: {
            followerId: follower.id,
            followingId: following.id,
          },
        },
        create: {
          followerId: follower.id,
          followingId: following.id,
        },
        update: {},
      });
    }
  }

  // 3. Intents com Histórias, Metas, Comentários e Reações
  const intentsData: SeedIntentDef[] = [
    {
      creatorUsername: 'miranha',
      title: 'Campanha Solidária de Quadrinhos e Livros para Comunidades',
      story: 'Estou reunindo uma biblioteca móvel para levar leitura, quadrinhos e oficinas de desenho gratuitas para jovens da periferia. Quando batermos 5 apoios, revelo o primeiro ponto de atendimento e o mapa da rota!',
      category: 'SOCIAL_IMPACT',
      conditionType: 'SUPPORT',
      supportGoal: 5,
      revealContent: 'O primeiro ponto será no Centro Comunitário Vila Esperança com 300 títulos já catalogados! Obrigado pelo apoio de todos!',
      supporters: ['batima', 'snoop', 'will', 'edinho_grubert'],
      comments: [
        { authorUsername: 'batima', text: 'Excelente iniciativa. Conte com o apoio de infraestrutura e logística.' },
        { authorUsername: 'snoop', text: 'Isso é muito maneiro! Vou doar alguns exemplares autografados.' },
        { authorUsername: 'edinho_grubert', text: 'Sensacional, já apoiei! Vamos fazer acontecer.' },
      ],
      reactions: [
        { username: 'batima', type: 'LIKE' },
        { username: 'snoop', type: 'LOVE' },
        { username: 'will', type: 'CELEBRATE' },
        { username: 'edinho_grubert', type: 'LOVE' },
      ],
    },
    {
      creatorUsername: 'batima',
      title: 'Plataforma Aberta de Transparência e Auditoria de Gastos Públicos',
      story: 'Desenvolvemos um bot independente que cruza notas fiscais e licitações municipais em tempo real, gerando alertas de anomalias sem viés partidário.',
      category: 'TECHNOLOGY',
      conditionType: 'SUPPORT',
      supportGoal: 4,
      revealContent: 'Repositório aberto e painel de acompanhamento liberados em: https://github.com/transparencia-aberta/scanner',
      supporters: ['miranha', 'will', 'henry'],
      comments: [
        { authorUsername: 'will', text: 'Muito relevante! Qual stack foi utilizada no crawler de PDFs?' },
        { authorUsername: 'batima', text: 'Node.js com processamento distribuído e OCR em pipelines isolados.' },
        { authorUsername: 'henry', text: 'Excelente arquitetura. Já deixei meu apoio!' },
      ],
      reactions: [
        { username: 'miranha', type: 'LIKE' },
        { username: 'will', type: 'CELEBRATE' },
        { username: 'edinho_grubert', type: 'LIKE' },
      ],
    },
    {
      creatorUsername: 'snoop',
      title: 'Pré-lançamento do Álbum Instrumental "Frequências da Calmaria"',
      story: 'Passei os últimos 6 meses gravando arranjos orgânicos afinados em 432Hz focados em foco e meditação profunda. Apoiando este Intent você ganha o link exclusivo de escuta antecipada.',
      category: 'ARTS_CULTURE',
      conditionType: 'SUPPORT',
      supportGoal: 4,
      revealContent: 'Aqui está a master original em alta definição: https://soundcloud.com/snoop/calmaria-instrumental-vip',
      supporters: ['miranha', 'batima', 'willian_santos'],
      comments: [
        { authorUsername: 'miranha', text: 'Já coloquei nos fones enquanto trabalho nos esboços, vibe impecável!' },
        { authorUsername: 'willian_santos', text: 'Som incrível, parabéns pela qualidade da produção.' },
      ],
      reactions: [
        { username: 'miranha', type: 'LOVE' },
        { username: 'batima', type: 'LIKE' },
        { username: 'edinho_grubert', type: 'LOVE' },
      ],
    },
    {
      creatorUsername: 'will',
      title: 'Mentoria Gratuita de Carreira em Tech para 50 Jovens Devs',
      story: 'Abrindo turmas semanais com code reviews práticos, simulações de entrevistas e preparação para mercado internacional.',
      category: 'EDUCATION',
      conditionType: 'SUPPORT',
      supportGoal: 6,
      revealContent: 'Link da sala de mentoria e cronograma completo de encontros: https://meet.google.com/tech-mentoria-will',
      supporters: ['henry', 'batima', 'snoop', 'willian_santos', 'edinho_grubert'],
      comments: [
        { authorUsername: 'henry', text: 'Posso participar como mentor convidado em uma das sessões sobre microsserviços!' },
        { authorUsername: 'will', text: 'Fechado, Henry! Vai ser um valor gigantesco para o pessoal.' },
        { authorUsername: 'edinho_grubert', text: 'Iniciativa transformadora. Parabéns, Will!' },
      ],
      reactions: [
        { username: 'henry', type: 'CELEBRATE' },
        { username: 'snoop', type: 'LIKE' },
        { username: 'edinho_grubert', type: 'CELEBRATE' },
      ],
    },
    {
      creatorUsername: 'henry',
      title: 'Guia Definitivo: Padrões Resilientes em Sistemas Distribuídos',
      story: 'Compilado prático com 20 estudos de caso reais de falhas em produção e como implementar Circuit Breakers, Bulkheads e Idempotência com zero overhead.',
      category: 'TECHNOLOGY',
      conditionType: 'SUPPORT',
      supportGoal: 3,
      revealContent: 'E-book gratuito liberado em PDF e EPUB: https://arquiteturaderesiliencia.org/download',
      supporters: ['will', 'batima', 'edinho_grubert'],
      comments: [
        { authorUsername: 'batima', text: 'Material mandatório para qualquer engenharia séria.' },
        { authorUsername: 'will', text: 'Leitura obrigatória. Já recomendei para toda a equipe!' },
      ],
      reactions: [
        { username: 'batima', type: 'LIKE' },
        { username: 'will', type: 'CELEBRATE' },
        { username: 'edinho_grubert', type: 'LIKE' },
      ],
    },
    {
      creatorUsername: 'willian_santos',
      title: 'Criação do Espaço Maker Comunitário de Robótica e Impressão 3D',
      story: 'Estamos montando um espaço com ferramentas abertas para prototipagem e oficinas práticas de eletrônica para estudantes.',
      category: 'TECHNOLOGY',
      conditionType: 'SUPPORT',
      supportGoal: 5,
      revealContent: 'Endereço e lista de equipamentos inaugurais do FabLab Comunitário disponíveis!',
      supporters: ['will', 'miranha', 'henry', 'edinho_grubert'],
      comments: [
        { authorUsername: 'miranha', text: 'Vou ajudar a pintar e personalizar o espaço no fim de semana!' },
        { authorUsername: 'willian_santos', text: 'Demais, toda ajuda é super bem-vinda!' },
      ],
      reactions: [
        { username: 'miranha', type: 'LOVE' },
        { username: 'will', type: 'CELEBRATE' },
        { username: 'edinho_grubert', type: 'CELEBRATE' },
      ],
    },
  ];

  console.log('Criando Intents, apoios, comentários e reações...');
  for (const item of intentsData) {
    const creator = userMap.get(item.creatorUsername);
    if (!creator) {
      console.warn(`Criador não encontrado: ${item.creatorUsername}`);
      continue;
    }

    // Verificar se intent com título similar já existe
    const existing = await prisma.intent.findFirst({
      where: {
        creatorId: creator.id,
        title: item.title,
      },
    });

    let intentId = existing?.id;

    if (!existing) {
      intentId = randomUUID();
      const revealVersion = 1;
      const sealed = sealReveal(
        item.revealContent,
        config.revealEncryptionKey,
        revealAssociatedData(intentId, revealVersion)
      );

      const isGoalReached = item.supporters.length >= item.supportGoal;

      await prisma.intent.create({
        data: {
          id: intentId,
          creatorId: creator.id,
          type: 'SUPPORT_REVEAL',
          conditionType: item.conditionType,
          status: isGoalReached ? 'REALIZED' : 'PUBLISHED',
          visibility: 'PUBLIC',
          category: item.category,
          title: item.title,
          story: item.story,
          supportGoal: item.supportGoal,
          supportCount: item.supporters.length,
          publishedAt: new Date(),
          realizedAt: isGoalReached ? new Date() : null,
          revealCiphertext: sealed.ciphertext,
          revealIv: sealed.iv,
          revealAuthTag: sealed.authTag,
          revealVersion,
        },
      });

      console.log(`✓ Intent criado: "${item.title}" por @${creator.username}`);
    } else {
      console.log(`- Intent existente: "${item.title}"`);
    }

    if (!intentId) continue;

    // 4. Criar Apoios (Supports)
    for (const supporterUser of item.supporters) {
      const supporter = userMap.get(supporterUser);
      if (supporter) {
        await prisma.support.upsert({
          where: {
            intentId_userId: {
              intentId,
              userId: supporter.id,
            },
          },
          create: {
            intentId,
            userId: supporter.id,
          },
          update: {},
        });
      }
    }

    // Atualizar contagem de apoios no Intent
    const supportCount = await prisma.support.count({ where: { intentId } });
    await prisma.intent.update({
      where: { id: intentId },
      data: {
        supportCount,
        status: supportCount >= item.supportGoal ? 'REALIZED' : 'PUBLISHED',
        realizedAt: supportCount >= item.supportGoal ? new Date() : null,
      },
    });

    // 5. Criar Comentários
    for (const comment of item.comments) {
      const author = userMap.get(comment.authorUsername);
      if (author) {
        const commentExists = await prisma.intentComment.findFirst({
          where: {
            intentId,
            authorId: author.id,
            body: comment.text,
          },
        });

        if (!commentExists) {
          await prisma.intentComment.create({
            data: {
              intentId,
              authorId: author.id,
              body: comment.text,
            },
          });
        }
      }
    }

    // 6. Criar Reações
    for (const reaction of item.reactions) {
      const reactor = userMap.get(reaction.username);
      if (reactor) {
        await prisma.intentReaction.upsert({
          where: {
            intentId_userId: {
              intentId,
              userId: reactor.id,
            },
          },
          create: {
            intentId,
            userId: reactor.id,
            type: reaction.type,
          },
          update: {
            type: reaction.type,
          },
        });
      }
    }
  }

  console.log('Povoamento concluído com sucesso!');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Erro no seed:', err);
  process.exit(1);
});
