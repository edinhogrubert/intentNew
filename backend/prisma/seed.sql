-- =============================================================================
-- INTENT OS — Script SQL de Povoamento Inicial (Seed Social)
-- Tabelas: users, follows, intents, supports, intent_comments, intent_reactions, notifications
-- =============================================================================

BEGIN;

-- 1. USUÁRIOS
INSERT INTO users (id, firebase_uid, email, username, display_name, bio, avatar_url, status, created_at, updated_at)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'mock-edinho_grubert', 'edinho_grubert@intent.internal', 'edinho_grubert', 'Edinho Grubert', 'Criador de acontecimentos e entusiasta do Intent OS.', 'https://api.dicebear.com/7.x/bottts/svg?seed=edinho_grubert', 'ACTIVE', NOW(), NOW()),
  ('22222222-2222-4222-8222-222222222222', 'mock-miranha', 'miranha@intent.internal', 'miranha', 'Miranha', 'Amigo da vizinhança. Defendendo causas justas e compartilhando arte independente.', 'https://api.dicebear.com/7.x/bottts/svg?seed=miranha', 'ACTIVE', NOW(), NOW()),
  ('33333333-3333-4333-8333-333333333333', 'mock-batima', 'batima@intent.internal', 'batima', 'Batima', 'Vigilante da transparência e inovação. A noite é apenas o começo.', 'https://api.dicebear.com/7.x/bottts/svg?seed=batima', 'ACTIVE', NOW(), NOW()),
  ('44444444-4444-4444-8444-444444444444', 'mock-snoop', 'snoop@intent.internal', 'snoop', 'Snoop', 'Música, vibe positiva, culinária e lifestyle sustentável.', 'https://api.dicebear.com/7.x/bottts/svg?seed=snoop', 'ACTIVE', NOW(), NOW()),
  ('55555555-5555-4555-8555-555555555555', 'mock-will', 'will@intent.internal', 'will', 'Will', 'Engenheiro de software, corredor amador e mentor de tecnologia.', 'https://api.dicebear.com/7.x/bottts/svg?seed=will', 'ACTIVE', NOW(), NOW()),
  ('66666666-6666-4666-8666-666666666666', 'mock-henry', 'henry@intent.internal', 'henry', 'Henry', 'Arquiteto de soluções distribuídas e autor técnico.', 'https://api.dicebear.com/7.x/bottts/svg?seed=henry', 'ACTIVE', NOW(), NOW()),
  ('77777777-7777-4777-8777-777777777777', 'mock-willian_santos', 'willian_santos@intent.internal', 'willian_santos', 'Willian Santos', 'Empreendedor social, maker e entusiasta de robótica.', 'https://api.dicebear.com/7.x/bottts/svg?seed=willian_santos', 'ACTIVE', NOW(), NOW())
ON CONFLICT (username) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  bio = EXCLUDED.bio,
  avatar_url = EXCLUDED.avatar_url,
  status = 'ACTIVE',
  updated_at = NOW();

-- 2. RELAÇÕES DE SEGUIDORES (FOLLOWS)
INSERT INTO follows (id, follower_id, following_id, created_at)
SELECT gen_random_uuid(), f.id, g.id, NOW()
FROM (
  VALUES
    ('edinho_grubert', 'miranha'),
    ('edinho_grubert', 'batima'),
    ('edinho_grubert', 'snoop'),
    ('edinho_grubert', 'will'),
    ('edinho_grubert', 'henry'),
    ('edinho_grubert', 'willian_santos'),
    ('miranha', 'batima'),
    ('miranha', 'edinho_grubert'),
    ('batima', 'miranha'),
    ('batima', 'will'),
    ('snoop', 'miranha'),
    ('snoop', 'edinho_grubert'),
    ('will', 'edinho_grubert'),
    ('will', 'henry'),
    ('henry', 'willian_santos'),
    ('willian_santos', 'will')
) AS pairs(follower_user, following_user)
JOIN users f ON f.username = pairs.follower_user
JOIN users g ON g.username = pairs.following_user
ON CONFLICT (follower_id, following_id) DO NOTHING;

-- 3. INTENTS
INSERT INTO intents (
  id, creator_id, type, condition_type, status, visibility, category,
  title, story, support_goal, support_count,
  reveal_ciphertext, reveal_iv, reveal_auth_tag, reveal_version,
  published_at, realized_at, created_at, updated_at
)
VALUES
  (
    'a1111111-1111-4111-8111-111111111111',
    (SELECT id FROM users WHERE username = 'miranha'),
    'SUPPORT_REVEAL', 'SUPPORT', 'PUBLISHED', 'PUBLIC', 'SOCIAL_IMPACT',
    'Campanha Solidária de Quadrinhos e Livros para Comunidades',
    'Estou reunindo uma biblioteca móvel para levar leitura, quadrinhos e oficinas de desenho gratuitas para jovens da periferia. Quando batermos 5 apoios, revelo o primeiro ponto de atendimento e o mapa da rota!',
    5, 4,
    'bW9jay1yZXZlYWwtY2lwaGVydGV4dA==', 'bW9jay1pdi0xMg==', 'bW9jay10YWctMTY=', 1,
    NOW() - INTERVAL '4 days', NULL, NOW() - INTERVAL '4 days', NOW()
  ),
  (
    'a2222222-2222-4222-8222-222222222222',
    (SELECT id FROM users WHERE username = 'batima'),
    'SUPPORT_REVEAL', 'SUPPORT', 'PUBLISHED', 'PUBLIC', 'TECHNOLOGY',
    'Plataforma Aberta de Transparência e Auditoria de Gastos Públicos',
    'Desenvolvemos um bot independente que cruza notas fiscais e licitações municipais em tempo real, gerando alertas de anomalias sem viés partidário.',
    4, 3,
    'bW9jay1yZXZlYWwtY2lwaGVydGV4dA==', 'bW9jay1pdi0xMg==', 'bW9jay10YWctMTY=', 1,
    NOW() - INTERVAL '3 days', NULL, NOW() - INTERVAL '3 days', NOW()
  ),
  (
    'a3333333-3333-4333-8333-333333333333',
    (SELECT id FROM users WHERE username = 'snoop'),
    'SUPPORT_REVEAL', 'SUPPORT', 'PUBLISHED', 'PUBLIC', 'ARTS_CULTURE',
    'Pré-lançamento do Álbum Instrumental "Frequências da Calmaria"',
    'Passei os últimos 6 meses gravando arranjos orgânicos afinados em 432Hz focados em foco e meditação profunda. Apoiando este Intent você ganha o link exclusivo de escuta antecipada.',
    4, 3,
    'bW9jay1yZXZlYWwtY2lwaGVydGV4dA==', 'bW9jay1pdi0xMg==', 'bW9jay10YWctMTY=', 1,
    NOW() - INTERVAL '2 days', NULL, NOW() - INTERVAL '2 days', NOW()
  ),
  (
    'a4444444-4444-4444-8444-444444444444',
    (SELECT id FROM users WHERE username = 'will'),
    'SUPPORT_REVEAL', 'SUPPORT', 'REALIZED', 'PUBLIC', 'EDUCATION',
    'Mentoria Gratuita de Carreira em Tech para 50 Jovens Devs',
    'Abrindo turmas semanais com code reviews práticos, simulações de entrevistas e preparação para mercado internacional.',
    5, 5,
    'bW9jay1yZXZlYWwtY2lwaGVydGV4dA==', 'bW9jay1pdi0xMg==', 'bW9jay10YWctMTY=', 1,
    NOW() - INTERVAL '5 days', NOW() - INTERVAL '1 day', NOW() - INTERVAL '5 days', NOW()
  ),
  (
    'a5555555-5555-4555-8555-555555555555',
    (SELECT id FROM users WHERE username = 'henry'),
    'SUPPORT_REVEAL', 'SUPPORT', 'REALIZED', 'PUBLIC', 'TECHNOLOGY',
    'Guia Definitivo: Padrões Resilientes em Sistemas Distribuídos',
    'Compilado prático com 20 estudos de caso reais de falhas em produção e como implementar Circuit Breakers, Bulkheads e Idempotência com zero overhead.',
    3, 3,
    'bW9jay1yZXZlYWwtY2lwaGVydGV4dA==', 'bW9jay1pdi0xMg==', 'bW9jay10YWctMTY=', 1,
    NOW() - INTERVAL '6 days', NOW() - INTERVAL '2 days', NOW() - INTERVAL '6 days', NOW()
  ),
  (
    'a6666666-6666-4666-8666-666666666666',
    (SELECT id FROM users WHERE username = 'willian_santos'),
    'SUPPORT_REVEAL', 'SUPPORT', 'PUBLISHED', 'PUBLIC', 'TECHNOLOGY',
    'Criação do Espaço Maker Comunitário de Robótica e Impressão 3D',
    'Estamos montando um espaço com ferramentas abertas para prototipagem e oficinas práticas de eletrônica para estudantes.',
    5, 4,
    'bW9jay1yZXZlYWwtY2lwaGVydGV4dA==', 'bW9jay1pdi0xMg==', 'bW9jay10YWctMTY=', 1,
    NOW() - INTERVAL '1 day', NULL, NOW() - INTERVAL '1 day', NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- 4. APOIOS (SUPPORTS)
INSERT INTO supports (id, intent_id, user_id, created_at)
SELECT gen_random_uuid(), i.id, u.id, NOW() - INTERVAL '1 hour'
FROM (
  VALUES
    ('Campanha Solidária de Quadrinhos e Livros para Comunidades', 'batima'),
    ('Campanha Solidária de Quadrinhos e Livros para Comunidades', 'snoop'),
    ('Campanha Solidária de Quadrinhos e Livros para Comunidades', 'will'),
    ('Campanha Solidária de Quadrinhos e Livros para Comunidades', 'edinho_grubert'),
    ('Plataforma Aberta de Transparência e Auditoria de Gastos Públicos', 'miranha'),
    ('Plataforma Aberta de Transparência e Auditoria de Gastos Públicos', 'will'),
    ('Plataforma Aberta de Transparência e Auditoria de Gastos Públicos', 'henry'),
    ('Pré-lançamento do Álbum Instrumental "Frequências da Calmaria"', 'miranha'),
    ('Pré-lançamento do Álbum Instrumental "Frequências da Calmaria"', 'batima'),
    ('Pré-lançamento do Álbum Instrumental "Frequências da Calmaria"', 'willian_santos'),
    ('Mentoria Gratuita de Carreira em Tech para 50 Jovens Devs', 'henry'),
    ('Mentoria Gratuita de Carreira em Tech para 50 Jovens Devs', 'batima'),
    ('Mentoria Gratuita de Carreira em Tech para 50 Jovens Devs', 'snoop'),
    ('Mentoria Gratuita de Carreira em Tech para 50 Jovens Devs', 'willian_santos'),
    ('Mentoria Gratuita de Carreira em Tech para 50 Jovens Devs', 'edinho_grubert'),
    ('Guia Definitivo: Padrões Resilientes em Sistemas Distribuídos', 'will'),
    ('Guia Definitivo: Padrões Resilientes em Sistemas Distribuídos', 'batima'),
    ('Guia Definitivo: Padrões Resilientes em Sistemas Distribuídos', 'edinho_grubert'),
    ('Criação do Espaço Maker Comunitário de Robótica e Impressão 3D', 'will'),
    ('Criação do Espaço Maker Comunitário de Robótica e Impressão 3D', 'miranha'),
    ('Criação do Espaço Maker Comunitário de Robótica e Impressão 3D', 'henry'),
    ('Criação do Espaço Maker Comunitário de Robótica e Impressão 3D', 'edinho_grubert')
) AS s(intent_title, username)
JOIN intents i ON i.title = s.intent_title
JOIN users u ON u.username = s.username
ON CONFLICT (intent_id, user_id) DO NOTHING;

-- Sincroniza support_count nos Intents
UPDATE intents i
SET support_count = (SELECT COUNT(*) FROM supports s WHERE s.intent_id = i.id);

-- 5. COMENTÁRIOS (INTENT_COMMENTS)
INSERT INTO intent_comments (id, intent_id, author_id, body, created_at, updated_at)
SELECT gen_random_uuid(), i.id, u.id, c.comment_text, NOW() - INTERVAL '30 minutes', NOW()
FROM (
  VALUES
    ('Campanha Solidária de Quadrinhos e Livros para Comunidades', 'batima', 'Excelente iniciativa. Conte com o apoio de infraestrutura e logística.'),
    ('Campanha Solidária de Quadrinhos e Livros para Comunidades', 'snoop', 'Isso é muito maneiro! Vou doar alguns exemplares autografados.'),
    ('Campanha Solidária de Quadrinhos e Livros para Comunidades', 'edinho_grubert', 'Sensacional, já apoiei! Vamos fazer acontecer.'),
    ('Plataforma Aberta de Transparência e Auditoria de Gastos Públicos', 'will', 'Muito relevante! Qual stack foi utilizada no crawler de PDFs?'),
    ('Plataforma Aberta de Transparência e Auditoria de Gastos Públicos', 'batima', 'Node.js com processamento distribuído e OCR em pipelines isolados.'),
    ('Plataforma Aberta de Transparência e Auditoria de Gastos Públicos', 'henry', 'Excelente arquitetura. Já deixei meu apoio!'),
    ('Pré-lançamento do Álbum Instrumental "Frequências da Calmaria"', 'miranha', 'Já coloquei nos fones enquanto trabalho nos esboços, vibe impecável!'),
    ('Pré-lançamento do Álbum Instrumental "Frequências da Calmaria"', 'willian_santos', 'Som incrível, parabéns pela qualidade da produção.'),
    ('Mentoria Gratuita de Carreira em Tech para 50 Jovens Devs', 'henry', 'Posso participar como mentor convidado em uma das sessões sobre microsserviços!'),
    ('Mentoria Gratuita de Carreira em Tech para 50 Jovens Devs', 'will', 'Fechado, Henry! Vai ser um valor gigantesco para o pessoal.'),
    ('Mentoria Gratuita de Carreira em Tech para 50 Jovens Devs', 'edinho_grubert', 'Iniciativa transformadora. Parabéns, Will!'),
    ('Guia Definitivo: Padrões Resilientes em Sistemas Distribuídos', 'batima', 'Material mandatório para qualquer engenharia séria.'),
    ('Guia Definitivo: Padrões Resilientes em Sistemas Distribuídos', 'will', 'Leitura obrigatória. Já recomendei para toda a equipe!'),
    ('Criação do Espaço Maker Comunitário de Robótica e Impressão 3D', 'miranha', 'Vou ajudar a pintar e personalizar o espaço no fim de semana!'),
    ('Criação do Espaço Maker Comunitário de Robótica e Impressão 3D', 'willian_santos', 'Demais, toda ajuda é super bem-vinda!')
) AS c(intent_title, author_username, comment_text)
JOIN intents i ON i.title = c.intent_title
JOIN users u ON u.username = c.author_username;

-- 6. REAÇÕES (INTENT_REACTIONS)
INSERT INTO intent_reactions (id, intent_id, user_id, type, created_at, updated_at)
SELECT gen_random_uuid(), i.id, u.id, r.reaction_type::"IntentReactionType", NOW() - INTERVAL '15 minutes', NOW()
FROM (
  VALUES
    ('Campanha Solidária de Quadrinhos e Livros para Comunidades', 'batima', 'LIKE'),
    ('Campanha Solidária de Quadrinhos e Livros para Comunidades', 'snoop', 'LOVE'),
    ('Campanha Solidária de Quadrinhos e Livros para Comunidades', 'will', 'CELEBRATE'),
    ('Campanha Solidária de Quadrinhos e Livros para Comunidades', 'edinho_grubert', 'LOVE'),
    ('Plataforma Aberta de Transparência e Auditoria de Gastos Públicos', 'miranha', 'LIKE'),
    ('Plataforma Aberta de Transparência e Auditoria de Gastos Públicos', 'will', 'CELEBRATE'),
    ('Plataforma Aberta de Transparência e Auditoria de Gastos Públicos', 'edinho_grubert', 'LIKE'),
    ('Pré-lançamento do Álbum Instrumental "Frequências da Calmaria"', 'miranha', 'LOVE'),
    ('Pré-lançamento do Álbum Instrumental "Frequências da Calmaria"', 'batima', 'LIKE'),
    ('Pré-lançamento do Álbum Instrumental "Frequências da Calmaria"', 'edinho_grubert', 'LOVE'),
    ('Mentoria Gratuita de Carreira em Tech para 50 Jovens Devs', 'henry', 'CELEBRATE'),
    ('Mentoria Gratuita de Carreira em Tech para 50 Jovens Devs', 'snoop', 'LIKE'),
    ('Mentoria Gratuita de Carreira em Tech para 50 Jovens Devs', 'edinho_grubert', 'CELEBRATE'),
    ('Guia Definitivo: Padrões Resilientes em Sistemas Distribuídos', 'batima', 'LIKE'),
    ('Guia Definitivo: Padrões Resilientes em Sistemas Distribuídos', 'will', 'CELEBRATE'),
    ('Guia Definitivo: Padrões Resilientes em Sistemas Distribuídos', 'edinho_grubert', 'LIKE'),
    ('Criação do Espaço Maker Comunitário de Robótica e Impressão 3D', 'miranha', 'LOVE'),
    ('Criação do Espaço Maker Comunitário de Robótica e Impressão 3D', 'will', 'CELEBRATE'),
    ('Criação do Espaço Maker Comunitário de Robótica e Impressão 3D', 'edinho_grubert', 'CELEBRATE')
) AS r(intent_title, reactor_username, reaction_type)
JOIN intents i ON i.title = r.intent_title
JOIN users u ON u.username = r.reactor_username
ON CONFLICT (intent_id, user_id) DO UPDATE SET
  type = EXCLUDED.type,
  updated_at = NOW();

-- 7. NOTIFICAÇÕES (NOTIFICATIONS)
-- 7.1 Notificações de Seguidor Recebido
INSERT INTO notifications (id, user_id, actor_id, type, deduplication_key, created_at)
SELECT gen_random_uuid(), f.following_id, f.follower_id, 'FOLLOW_RECEIVED'::"NotificationType", 'seed:follow:' || f.follower_id || ':' || f.following_id, f.created_at
FROM follows f
ON CONFLICT (deduplication_key) DO NOTHING;

-- 7.2 Notificações de Apoio Recebido
INSERT INTO notifications (id, user_id, actor_id, intent_id, type, deduplication_key, created_at)
SELECT gen_random_uuid(), i.creator_id, s.user_id, s.intent_id, 'SUPPORT_RECEIVED'::"NotificationType", 'seed:support:' || s.intent_id || ':' || s.user_id, s.created_at
FROM supports s
JOIN intents i ON i.id = s.intent_id
WHERE s.user_id <> i.creator_id
ON CONFLICT (deduplication_key) DO NOTHING;

-- 7.3 Notificações de Reação Recebida
INSERT INTO notifications (id, user_id, actor_id, intent_id, type, deduplication_key, created_at)
SELECT gen_random_uuid(), i.creator_id, r.user_id, r.intent_id, 'INTENT_REACTION_RECEIVED'::"NotificationType", 'seed:reaction:' || r.intent_id || ':' || r.user_id, r.created_at
FROM intent_reactions r
JOIN intents i ON i.id = r.intent_id
WHERE r.user_id <> i.creator_id
ON CONFLICT (deduplication_key) DO NOTHING;

COMMIT;
