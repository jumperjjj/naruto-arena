{-# LANGUAGE OverloadedLists #-}
module DBD (characters, variants) where
import Game.Characters.Import
import qualified Game.Model.Skill as S
import qualified Game.Model.Character as C
import qualified Prelude as Base

-- Q/W/E/R from Riot's kits; numbers, targeting and durations adapted to turns.
baseCharacters :: [Character]
baseCharacters =
 [ Character "Ahri" 0 "A Raposa de Nove Caudas. Combina dano mágico, dano verdadeiro e encanto. As três investidas de sua ultimate viram uma ação de três turnos." []
   [[S.new {S.name="Orbe da Ilusão",S.desc="Causa 12 de dano mágico na ida e 12 de dano verdadeiro na volta a um inimigo. O retorno ignora redução de dano, mas respeita escudos.",S.classes=[Chakra,Ranged],S.cost=[Nin,Rand],S.effects=[To Enemy do damage 12; pierce 12]}],
    [S.new {S.name="Fogo de Raposa",S.desc="Três chamas perseguem um inimigo e causam 20 de dano mágico no total. Se o alvo estiver sob Encanto de Ahri, as chamas priorizadas causam 5 de dano adicional.",S.classes=[Chakra,Ranged],S.cost=[Nin],S.cooldown=1,S.effects=[To Enemy do b <- bonusIf 5 (target has "Encanto"); damage (20+b)]}],
    [S.new {S.name="Encanto",S.desc="Causa 10 de dano mágico e encanta um inimigo por 1 turno, impedindo o uso de suas habilidades.",S.classes=[Mental,Ranged],S.cost=[Nin,Gen],S.cooldown=3,S.effects=[To Enemy do damage 10; apply 1 skillName [Stun All]]}],
    [S.new {S.name="Ímpeto Espiritual",S.desc="Dispara raios de essência: causa 8 de dano mágico a todos os inimigos por turno durante 3 turnos. As três investidas viram uma ação contínua; não concedem invulnerabilidade.",S.classes=[Chakra,Ranged],S.cost=[Nin,Nin,Rand],S.cooldown=4,S.dur=Action 3,S.effects=[To Enemies $ damage 8]}]] Original "ahri"
 , Character "Lux" 0 "A Dama da Luz. Enraíza, protege os aliados e prepara uma explosão antes de disparar seu raio final. Sem ataques automáticos, a passiva Iluminação não é simulada." []
   [[S.new {S.name="Ligação da Luz",S.desc="Causa 20 de dano mágico e enraíza um inimigo por 1 turno. Enraizar bloqueia habilidades corpo a corpo, mas permite habilidades à distância. O segundo alvo do projétil não é simulado.",S.classes=[Chakra,Ranged],S.cost=[Nin,Gen],S.cooldown=2,S.effects=[To Enemy do damage 20; apply 1 skillName [Stun Melee]]}],
    [S.new {S.name="Barreira Prismática",S.desc="Protege todos os aliados com um escudo de 20 por 1 turno. Absorve dano antes da vida; não concede invulnerabilidade.",S.classes=[Chakra],S.cost=[Nin,Gen,Rand],S.cooldown=3,S.effects=[To Allies $ defend 1 20]}],
    [S.new {S.name="Singularidade Lucente",S.desc="Prepara uma zona de luz em todos os inimigos. Após o próximo turno adversário, explode causando 20 de dano mágico em cada alvo. A detonação é automática nesta arena.",S.classes=[Chakra,Ranged],S.cost=[Nin,Rand],S.cooldown=2,S.effects=[To Enemies $ bomb (-1) skillName [] [To Expire $ damage 20]]}],
    [S.new {S.name="Centelha Final",S.desc="Dispara um raio que causa 30 de dano mágico a todos os inimigos.",S.classes=[Chakra,Ranged],S.cost=[Nin,Nin,Gen,Rand],S.cooldown=4,S.effects=[To Enemies $ damage 30]}]] Original "lux"
 , Character "Garen" 0 "O Poder de Demacia. Silencia, resiste e gira entre os inimigos. A ultimate pune alvos feridos. No LoL não usa mana; aqui consome os recursos compartilhados da equipe." []
   [[S.new {S.name="Acerto Decisivo",S.desc="Causa 20 de dano físico e silencia um inimigo por 1 turno, bloqueando suas habilidades. Movimentação e ataques automáticos não são simulados nesta arena.",S.classes=[Physical,Melee],S.cost=[Tai,Rand],S.cooldown=2,S.effects=[To Enemy do damage 20; apply 1 skillName [Stun All]]}],
    [S.new {S.name="Coragem",S.desc="Garen recebe um escudo de 15 e reduz em 10 o dano físico e mágico recebido por 1 turno. Não concede invulnerabilidade.",S.classes=[Physical],S.cost=[Tai],S.cooldown=3,S.effects=[To Self do defend 1 15; apply 1 skillName [Reduce [Physical,Chakra] Flat 10]]}],
    [S.new {S.name="Julgamento",S.desc="Gira a espada: causa 10 de dano físico a todos os inimigos por turno durante 2 turnos. Atordoar Garen suspende o dano daquele turno.",S.classes=[Physical,Melee],S.cost=[Tai,Blood,Rand],S.cooldown=3,S.dur=Action 2,S.effects=[To Enemies $ damage 10]}],
    [S.new {S.name="Justiça Demaciana",S.desc="Causa 20 de dano verdadeiro, mais 25% da vida que falta ao alvo. Ignora redução de dano, mas respeita escudos.",S.classes=[Physical,Melee],S.cost=[Blood,Blood,Rand],S.cooldown=4,S.effects=[To Enemy do missing <- (100-) <$> target health; pierce (20+missing `div` 4)]}]] Original "garen"
 , Character "Darius" 0 "A Mão de Noxus. Seus golpes aplicam Hemorragia: até 5 acúmulos, cada um causando 3 de dano físico por turno durante 3 turnos. A guilhotina cresce com os acúmulos." []
   [[S.new {S.name="Dizimar",S.desc="Causa 15 de dano físico a todos os inimigos. Em cada alvo que perder vida, aplica 1 acúmulo de Hemorragia e recupera 5 de vida de Darius.",S.classes=[Physical,Melee],S.cost=[Blood,Tai,Rand],S.cooldown=2,S.effects=[To Enemies do before <- target health; damage 15; after <- target health; when (after<before) do hemorrhage; targeting Self $ heal 5]}],
    [S.new {S.name="Ataque Mutilador",S.desc="Causa 20 de dano físico a um inimigo. Se tirar vida, aplica 1 acúmulo de Hemorragia. A lentidão de movimento não é simulada.",S.classes=[Physical,Melee],S.cost=[Blood],S.cooldown=1,S.effects=[To Enemy do before <- target health; damage 20; after <- target health; when (after<before) hemorrhage]}],
    [S.new {S.name="Apreender",S.desc="Puxa um inimigo e o suspende por 1 turno, impedindo suas habilidades. A puxada vira um controle de alvo único nesta arena e não causa dano.",S.classes=[Physical,Melee],S.cost=[Tai,Gen],S.cooldown=3,S.effects=[To Enemy $ apply 1 skillName [Stun All]]}],
    [S.new {S.name="Guilhotina de Noxus",S.desc="Causa 20 de dano verdadeiro, mais 5 por acúmulo de Hemorragia no alvo, até 45. Ignora redução, mas respeita escudos. Se abater o alvo, reinicia a própria recarga.",S.classes=[Physical,Melee],S.cost=[Blood,Blood,Rand],S.cooldown=4,S.effects=[To Enemy do stacks <- target amount "Hemorragia"; pierce (20+5*min 5 stacks); dead <- not <$> target alive; when dead $ resetCooldown skillName]}]] Original "darius"
 , Character "Soraka" 0 "A Filha das Estrelas. Regenera a própria vida para curar aliados, silencia uma área e salva a equipe com Desejo. Não possui ataque básico nesta arena." []
   [[S.new {S.name="Chamado Estelar",S.desc="Causa 15 de dano mágico a um inimigo. Se tirar vida, Soraka recebe Rejuvenescimento por 2 turnos: recupera 5 de vida por turno e reduz o sacrifício de Infusão Astral.",S.classes=[Chakra,Ranged],S.cost=[Nin],S.cooldown=1,S.effects=[To Enemy do before <- target health; damage 15; after <- target health; when (after<before) $ targeting Self $ applyWith [Nonstacking] 2 "Rejuvenescimento" [Heal 5]]}],
    [S.new {S.name="Infusão Astral",S.desc="Recupera 30 de vida de outro aliado. Consome 10 da vida de Soraka, sem deixá-la abaixo de 1; com Rejuvenescimento, consome apenas 5. Não pode ser usada em si mesma.",S.classes=[Chakra],S.cost=[Nin,Gen],S.cooldown=1,S.effects=[To XAlly $ heal 30,To Self do active <- user has "Rejuvenescimento"; sacrifice 1 (if active then 5 else 10)]}],
    [S.new {S.name="Equinócio",S.desc="Silencia todos os inimigos por 1 turno, impedindo suas habilidades. A zona fixa e o enraizamento ao permanecer nela são condensados neste controle de área.",S.classes=[Chakra,Ranged],S.cost=[Nin,Gen,Gen],S.cooldown=4,S.effects=[To Enemies $ apply 1 skillName [Stun All]]}],
    [S.new {S.name="Desejo",S.desc="Recupera 25 de vida de todos os aliados, incluindo Soraka. Em aliados com menos de 40 de vida, recupera 35 em vez de 25.",S.classes=[Chakra],S.cost=[Nin,Nin,Gen,Rand],S.cooldown=4,S.effects=[To Allies do low <- (<40) <$> target health; heal (if low then 35 else 25)]}]] Original "soraka"
 , Character "Zed" 0 "O Mestre das Sombras. A sombra repete suas técnicas e Marca Fatal premia concentrar golpes. No LoL usa energia; aqui usa os recursos compartilhados da equipe." []
   [[S.new {S.name="Shuriken Laminado",S.desc="Causa 20 de dano físico a um inimigo. Com Sombra Viva, a shuriken duplicada causa mais 10. O dano à vida alimenta sua Marca Fatal no alvo.",S.classes=[Physical,Ranged],S.cost=[Tai,Rand],S.effects=[To Enemy do b <- bonusIf 10 (user has "Sombra Viva"); recordHit (20+b)]}],
    [S.new {S.name="Sombra Viva",S.desc="Cria uma sombra por 2 turnos. Ela repete Shuriken Laminado e Corte Sombrio, acrescentando 10 de dano. A troca de posição e a devolução de energia não são simuladas.",S.classes=[Mental],S.cost=[Gen],S.cooldown=3,S.effects=[To Self $ applyWith [Nonstacking] 2 skillName []]}],
    [S.new {S.name="Corte Sombrio",S.desc="Causa 15 de dano físico a todos os inimigos. Com Sombra Viva, causa mais 10 em cada alvo. O dano à vida alimenta sua Marca Fatal.",S.classes=[Physical,Melee],S.cost=[Tai,Blood,Rand],S.cooldown=2,S.effects=[To Enemies do b <- bonusIf 10 (user has "Sombra Viva"); recordHit (15+b)]}],
    [S.new {S.name="Marca Fatal",S.desc="Marca um inimigo por 2 turnos. Ao terminar, causa 15 de dano físico, mais 30% do dano à vida causado pelas técnicas de Zed durante a marca. O avanço deixa Zed inalvejável por 1 turno nesta arena.",S.classes=[Physical,Melee],S.cost=[Gen,Blood,Rand],S.cooldown=4,S.effects=[To Enemy do remove "Eco da Marca"; bomb (-2) skillName [] [To Expire do stored <- target amount "Eco da Marca"; damage (15+stored*3 `div` 10); remove "Eco da Marca"],To Self $ apply 1 skillName [Invulnerable All]]}]] Original "zed"
 ]

-- Timed bombs keep bleeding physical: shields and reduction apply to every tick.
hemorrhage :: SkillEffect
hemorrhage = do
  stacks <- target amount "Hemorragia"
  when (stacks<5) $ bleedTick 3
  when (stacks>=1) $ targeting Self $ applyWith [Nonstacking] 3 "Fúria Noxiana" []
bleedTick :: Int -> SkillEffect
bleedTick turns = bomb (-1) "Hemorragia" [] [To Expire do damage 3; when (turns>1) $ bleedTick (turns-1)]

recordHit :: Int -> SkillEffect
recordHit value = do
  before <- target health
  damage value
  after <- target health
  marked <- target has "Marca Fatal"
  when (marked && before>after) $ addStacks' [Hidden] 3 "Eco da Marca" (before-after)

-- Four arena slots, not four MOBA keys. The final slot is always the common defense.
characters :: [Character]
characters = varySlots . adapt <$> baseCharacters

-- Different kits replace different slots: healing need not become a third-slot finisher.
varySlots :: Character -> Character
varySlots c = c {C.bio=biography,C.skills=arranged}
 where
  source=fromMaybe c $ find ((==c.ident) . C.ident) baseCharacters
  skills=toList c.skills
  at i=skills Base.!! i
  (biography,arranged)=case c.ident of
   "lux" -> (c.bio,[at 0,at 2,at 1,at 3])
   "garen" -> ("O Poder de Demacia. Julgamento libera Justiça Demaciana no lugar de Coragem por 3 turnos. Escolha manter a resistência ou preparar a execução; usar Justiça encerra o giro.",
     [at 0,[unlocks "Justiça Liberada" (garenJustice source) ((getSkill c "Coragem") {S.desc="Recebe um escudo de 15 e reduz em 10 o dano físico e mágico por 2 turnos. Após Julgamento, este espaço libera Justiça Demaciana."})],[(getSkill c "Julgamento") {S.changes=const id,S.desc="Causa 10 de dano físico a todos os inimigos por turno durante 2 turnos. Libera Justiça Demaciana no lugar de Coragem por 3 turnos. Usar a execução encerra o giro.",S.start=[To Self $ applyWith [Nonstacking] 3 "Justiça Liberada" []]}],at 3])
   "darius" -> ("A Mão de Noxus. Ao aplicar um segundo acúmulo de Hemorragia na mesma vítima, Ataque Mutilador vira Guilhotina de Noxus por 3 turnos. Apreender permanece disponível para controle.",
     [at 0,[unlocks "Fúria Noxiana" (dariusGuillotine source) ((getSkill c "Ataque Mutilador") {S.desc="Causa 20 de dano físico e aplica Hemorragia se tirar vida. Aplicar o segundo acúmulo na mesma vítima libera Guilhotina de Noxus neste espaço por 3 turnos."})],[(getSkill source "Apreender")],at 3])
   "soraka" -> ("A Filha das Estrelas. Chamado Estelar vira Desejo durante Rejuvenescimento. Nesse intervalo, Infusão Astral custa menos vida. Escolha a cura individual ou consuma o preparo para curar a equipe.",
     [[unlocks "Rejuvenescimento" (sorakaWish source) ((getSkill c "Chamado Estelar") {S.desc="Causa 15 de dano mágico. Se tirar vida, ativa Rejuvenescimento por 2 turnos: recupera 5 de vida por turno, reduz o sacrifício de Infusão Astral e transforma este espaço em Desejo."})],at 1,[(getSkill source "Equinócio")],at 3])
   _ -> (c.bio,c.skills)

getSkill :: Character -> Text -> Skill
getSkill c label = fromMaybe S.new $ find ((==label) . S.name) (join c.skills)

unlocks :: Text -> Skill -> Skill -> Skill
unlocks status alternative basic = basic
  { S.changes = \n active -> (changeWith status (\current -> alternative { S.owner=current.owner }) n active) {S.changes=const id} }

arenaDefense :: Character -> Skill
arenaDefense c = S.new
  { S.name=case c.ident of "ahri" -> "Evasão Espiritual"; "lux" -> "Refração Prismática"; "garen" -> "Guarda Demaciana"; "darius" -> "Guarda Noxiana"; "soraka" -> "Proteção Astral"; _ -> "Troca de Sombras"
  , S.desc="Essa habilidade faz " ++ c.name ++ " invulnerável por 1 turno."
  , S.classes=if (c.ident=="garen" || c.ident=="darius" || c.ident=="zed") then [Physical] else [Mental]
  , S.cost=[Rand]
  , S.cooldown=4
  , S.effects=[To Self $ apply 1 skillName [Invulnerable All]] }

adapt :: Character -> Character
adapt c = c { C.bio=bio, C.skills=loadout }
 where
  pick = getSkill c
  (bio,loadout) = case c.ident of
   "ahri" -> ("A Raposa de Nove Caudas. Encante uma vítima para liberar Ímpeto Espiritual no terceiro espaço. Escolha entre controle, dano misto e pressão contínua.",
    [[pick "Orbe da Ilusão"],
     [(pick "Encanto") { S.desc="Causa 10 de dano mágico e impede as habilidades de um inimigo por 1 turno. Também libera Ímpeto Espiritual no lugar de Fogo de Raposa por 3 turnos.",S.effects=[To Enemy do damage 10; apply 1 skillName [Stun All]; targeting Self $ applyWith [Nonstacking] 3 "Ímpeto Liberado" []] }],
     [unlocks "Ímpeto Liberado" (ahriSpirit c) ((pick "Fogo de Raposa") {S.desc="As três chamas causam 20 de dano mágico a um inimigo. Após usar Encanto, este espaço vira Ímpeto Espiritual por 3 turnos.",S.effects=[To Enemy $ damage 20]})],
     [arenaDefense c]])
   "lux" -> ("A Dama da Luz. Controle um alvo ou proteja seus aliados. Singularidade Lucente prepara o campo e libera Centelha Final no mesmo espaço.",
    [[pick "Ligação da Luz"],[pick "Barreira Prismática"],
     [unlocks "Luz Acumulada" (luxFinal c) ((pick "Singularidade Lucente") {S.desc="Prepara uma explosão que causa 20 de dano mágico a todos os inimigos após o próximo turno adversário. Libera Centelha Final neste espaço por 3 turnos.",S.effects=[To Enemies $ bomb (-1) skillName [] [To Expire $ damage 20],To Self $ applyWith [Nonstacking] 3 "Luz Acumulada" []]})],
     [arenaDefense c]])
   "garen" -> ("O Poder de Demacia. Silencie, resista ou comece Julgamento. Durante o giro, o terceiro espaço libera Justiça Demaciana: executar encerra o giro.",
    [[pick "Acerto Decisivo"],[(pick "Coragem") {S.desc="Recebe um escudo de 15 e reduz em 10 o dano físico e mágico por 2 turnos. Permite atacar protegido no turno seguinte, mas não concede invulnerabilidade.",S.effects=[To Self do defend 2 15; apply 2 skillName [Reduce [Physical,Chakra] Flat 10]]}],
     [unlocks "Justiça Liberada" (garenJustice c) ((pick "Julgamento") {S.desc="Causa 10 de dano físico a todos os inimigos por turno durante 2 turnos. Libera Justiça Demaciana neste espaço por 3 turnos. Usar a execução encerra o giro.",S.start=[To Self $ applyWith [Nonstacking] 3 "Justiça Liberada" []]})],
     [arenaDefense c]])
   "darius" -> ("A Mão de Noxus. Dizimar e Ataque Mutilador acumulam Hemorragia. Aplicar um segundo acúmulo na mesma vítima libera Guilhotina de Noxus no lugar de Apreender por 3 turnos.",
    [[pick "Dizimar"],[pick "Ataque Mutilador"],
     [unlocks "Fúria Noxiana" (dariusGuillotine c) ((pick "Apreender") {S.desc="Suspende um inimigo por 1 turno, impedindo suas habilidades. Ao aplicar um segundo acúmulo de Hemorragia com seus golpes, este espaço vira Guilhotina de Noxus por 3 turnos."})],
     [arenaDefense c]])
   "soraka" -> ("A Filha das Estrelas. Chamado Estelar ativa Rejuvenescimento: reduz o sacrifício da cura e libera Desejo no lugar de Equinócio. Usar Desejo consome essa preparação.",
    [[(pick "Chamado Estelar") {S.desc="Causa 15 de dano mágico. Se tirar vida, recebe Rejuvenescimento por 2 turnos: recupera 5 de vida por turno, reduz o custo de vida de Infusão Astral e libera Desejo no terceiro espaço."}],
     [pick "Infusão Astral"],
     [unlocks "Rejuvenescimento" (sorakaWish c) ((pick "Equinócio") {S.desc="Impede as habilidades de todos os inimigos por 1 turno. Com Rejuvenescimento, este espaço vira Desejo: uma cura para toda a equipe."})],
     [arenaDefense c]])
   _ -> ("O Mestre das Sombras. Sombra Viva fortalece Shuriken Laminado e libera Marca Fatal no lugar de Corte Sombrio. A marca consome a sombra; concentre os golpes para ampliar a explosão.",
    [[pick "Shuriken Laminado"],
     [(pick "Sombra Viva") {S.desc="Prepara uma sombra por 2 turnos: Shuriken Laminado causa 10 de dano adicional e Corte Sombrio se transforma em Marca Fatal. Usar a marca consome a sombra."}],
     [unlocks "Sombra Viva" (zedDeathMark c) ((pick "Corte Sombrio") {S.desc="Causa 15 de dano físico a todos os inimigos. Com Sombra Viva, este espaço vira Marca Fatal. O dano causado alimenta sua marca já aplicada."})],
     [arenaDefense c]])

ahriSpirit, luxFinal, garenJustice, dariusGuillotine, sorakaWish, zedDeathMark :: Character -> Skill
ahriSpirit c = (getSkill c "Ímpeto Espiritual")
 {S.desc="Consome Ímpeto Liberado. Causa 12 de dano mágico a todos os inimigos por turno durante 2 turnos. O custo é pago uma vez; atordoamento suspende o pulso.",S.dur=Action 2,S.cooldown=3,S.start=[To Self $ remove "Ímpeto Liberado"],S.effects=[To Enemies $ damage 12]}
luxFinal c = (getSkill c "Centelha Final")
 {S.desc="Consome Luz Acumulada e causa 25 de dano mágico a todos os inimigos. Este espaço volta a Singularidade Lucente.",S.effects=[To Enemies $ damage 25,To Self $ remove "Luz Acumulada"]}
garenJustice c = (getSkill c "Justiça Demaciana")
 {S.desc="Encerra Julgamento e consome Justiça Liberada. Causa 20 de dano verdadeiro, mais 25% da vida perdida do alvo. Ignora redução, mas respeita escudos. Este espaço volta a Coragem.",S.effects=[To Self do cancelChannel "Julgamento"; remove "Justiça Liberada",To Enemy do missing <- (100-) <$> target health; pierce (20+missing `div` 4)]}
dariusGuillotine c = (getSkill c "Guilhotina de Noxus")
 {S.desc="Consome Fúria Noxiana. Causa 20 de dano verdadeiro, mais 5 por acúmulo de Hemorragia no alvo, até 45. Ignora redução, mas respeita escudos. Este espaço volta a Ataque Mutilador.",S.effects=[To Enemy do stacks <- target amount "Hemorragia"; pierce (20+5*min 5 stacks),To Self $ remove "Fúria Noxiana"]}
sorakaWish c = (getSkill c "Desejo")
 {S.desc="Consome Rejuvenescimento e cura todos os aliados em 25. Nos aliados com menos de 40 de vida, cura 35. Este espaço volta a Chamado Estelar.",S.effects=[To Allies do low <- (<40) <$> target health; heal (if low then 35 else 25),To Self $ remove "Rejuvenescimento"]}
zedDeathMark c = (getSkill c "Marca Fatal")
 {S.desc="Consome Sombra Viva e marca um inimigo por 2 turnos. Ao terminar, causa 15 de dano físico, mais 30% do dano à vida causado por Zed durante a marca. Este espaço volta a Corte Sombrio.",S.effects=[To Enemy do remove "Eco da Marca"; bomb (-2) skillName [] [To Expire do stored <- target amount "Eco da Marca"; damage (15+stored*3 `div` 10); remove "Eco da Marca"],To Self $ remove "Sombra Viva"]}

variants :: Text -> [(Int,Skill)]
variants ident = case find ((==ident) . C.ident) baseCharacters of
 Nothing -> []
 Just c -> [(case ident of "lux" -> 1; "garen" -> 1; "darius" -> 1; "soraka" -> 0; _ -> 2,case ident of "ahri" -> ahriSpirit c; "lux" -> luxFinal c; "garen" -> garenJustice c; "darius" -> dariusGuillotine c; "soraka" -> sorakaWish c; _ -> zedDeathMark c)]







