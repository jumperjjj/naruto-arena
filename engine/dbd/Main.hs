{-# LANGUAGE FlexibleInstances #-}
{-# LANGUAGE TypeSynonymInstances #-}
module Main where

import ClassyPrelude hiding (getLine, putStrLn, hSetBuffering, try)
import qualified Prelude as Base
import Control.Exception (SomeException, try)
import Control.Monad.Trans.State.Strict (StateT, get, put, gets, modify', runStateT)
import Data.Aeson (Value, FromJSON(..), encode, eitherDecodeStrict', object, withObject, (.:), (.:?), (.!=), (.=))
import qualified Data.ByteString as BS
import qualified Data.ByteString.Lazy.Char8 as BL
import qualified Data.HashMap.Strict as HM
import qualified Data.Vector as V
import Data.List (nub)
import System.IO (hSetBuffering, BufferMode(LineBuffering), stdout, stdin, isEOF)
import System.Random.MWC (Gen, createSystemRandom)
import Class.Hook (MonadHook(..))
import Class.Play (MonadGame(..))
import qualified Class.Play as P
import Class.Random (MonadRandom(..))
import qualified Class.Random as R
import qualified Game.AI as AI
import qualified Game.Characters as Characters
import qualified Game.Characters.Classic as Classic
import qualified Game.Characters.ClassicFinal as ClassicFinal
import qualified Class.Parity as Parity
import qualified Game.Engine as Engine
import qualified Game.Engine.Ninjas as Ninjas
import qualified Game.Model.Chakras as C
import Game.Model.Chakras (Chakra(..), Chakras)
import qualified Game.Model.Character as Character
import Game.Model.Context (Context(..))
import qualified Game.Model.Game as Game
import qualified Game.Model.Ninja as N
import qualified Game.Model.ID as ID
import qualified Game.Model.Player as Player
import qualified Game.Model.Requirement as Req
import qualified Game.Model.Skill as Skill
import qualified Game.Model.Slot as Slot
import qualified Game.Model.Status as Status
import qualified Game.Model.Trap as Trap
import qualified Game.Model.Class as Class
import qualified Game.Model.Channel as Channel
import qualified Game.Model.Duration as Duration
import qualified Game.Model.Destructible as Defense

import qualified Game.Action.Combat as Combat
import qualified Game.Action.Status as Effects
import qualified Game.Action.Chakra as ChakraAction
import qualified Game.Action.Skill as SkillAction
import qualified Game.Action.Trap as TrapAction
import qualified Game.Model.Trigger as Trigger
import qualified Game.Model.Effect as Effect
import Game.Model.Runnable (Runnable(To), RunConstraint)
import Util ((!?))
import qualified NonNull as NN

data Battle = Battle { arena :: Game.Game, fighters :: Vector N.Ninja, roundNumber :: Int, journal :: [Text] }
type Runtime = StateT Battle (ReaderT (Gen RealWorld) IO)
instance MonadGame Runtime where
  game = gets arena
  alterGame f = modify' $ \b -> b { arena = f b.arena }
  ninjas = gets fighters
  ninja i = gets $ \b -> Slot.index b.fighters i
  write i n = modify' $ \b -> b { fighters = b.fighters V.// [(Slot.toInt i,n)] }
  modify i f = modify' $ \b -> b { fighters = b.fighters V.// [(Slot.toInt i, f (Slot.index b.fighters i))] }
  modifyAll f = modify' $ \b -> b { fighters = f <$> b.fighters }
instance MonadRandom Runtime where
  random = lift R.random
  range = lift . R.range
  shuffle = lift . R.shuffle
instance MonadHook Runtime where
  action sk _ _ = modify' $ \b -> b { journal = b.journal ++ [sk.name] }
  chakra _ _ _ = pure ()
  trap _ _ = pure ()
  trigger _ _ = pure ()
  turnEnd player _ _ = refreshSharingan (not . Parity.allied player)

refreshSharingan :: (N.Ninja -> Bool) -> Runtime ()
refreshSharingan eligible = do
  ns <- P.ninjas
  forM_ ns $ \n -> when (eligible n && N.alive n && n.character.ident == "classic-edo-tensei-itachi-s") $
    P.withContext (Context Skill.new n.slot n.slot False False) ClassicFinal.rotateSharingan

data Move = Move { actor :: Int, skillIndex :: Int, targetIndex :: Int }
instance FromJSON Move where
  parseJSON = withObject "Move" $ \o -> Move <$> o .: "actor" <*> o .: "skill" <*> o .: "target"
data Request = Request { command :: Text, team :: [Text], moves :: [Move], payment :: [Int], exchangeTo :: Maybe Int, player :: Int, opponentTeam :: [Text], sandbox :: Maybe [NinjaEdit] }
instance FromJSON Request where
  parseJSON = withObject "Request" $ \o -> Request <$> o .: "command" <*> o .:? "team" .!= [] <*> o .:? "moves" .!= [] <*> o .:? "payment" .!= [] <*> o .:? "exchangeTo" <*> o .:? "player" .!= 0 <*> o .:? "opponentTeam" .!= [] <*> o .:? "sandbox"

defaults :: [Text]
defaults = ["naruto-uzumaki","sasuke-uchiha","sakura-haruno"]
enemies :: [Text]
enemies = ["kakashi-hatake","zabuza-momochi","haku"]
-- Only this independent League roster is exposed.
catalog = (\c -> c { Character.skills = (Skill.withExtraClasses <$>) <$> c.skills })
    <$> filter ((/= "gaara-of-the-funk") . Character.ident) (Characters.siteList ++ Classic.characters)

data Recipe = Recipe Text Text Int Int Text Text Text
instance FromJSON Recipe where
  parseJSON = withObject "Recipe" $ \o -> Recipe <$> o .:? "kind" .!= "damage" <*> o .:? "target" .!= "enemy" <*> o .:? "value" .!= 0 <*> o .:? "turns" .!= 1 <*> o .:? "unit" .!= "flat" <*> o .:? "class" .!= "all" <*> o .:? "label" .!= ""
data SwapEdit = SwapEdit Int Int
instance FromJSON SwapEdit where
  parseJSON = withObject "Swap" $ \o -> SwapEdit <$> o .: "slot" <*> o .: "technique"
data Editor = Editor { eRecipes :: [Recipe], eClasses :: [Text], eChannel :: Text, eRequires :: Int, eUses :: Int, eConsume :: Bool, eMarkTurns :: Int, eInvisible :: Bool, eSlot :: Int, eSwaps :: [SwapEdit], eSwapTurns :: Int }
instance FromJSON Editor where
  parseJSON = withObject "Editor" $ \o -> Editor <$> o .:? "recipes" .!= [] <*> o .:? "classTags" .!= ["physical","melee"] <*> o .:? "channel" .!= "instant" <*> o .:? "requiresSkill" .!= 0 <*> o .:? "requiresUses" .!= 1 <*> o .:? "consume" .!= False <*> o .:? "markTurns" .!= 0 <*> o .:? "invisible" .!= False <*> o .:? "baseSlot" .!= 1 <*> o .:? "replacements" .!= [] <*> o .:? "replacementTurns" .!= 3

data SkillEdit = SkillEdit (Maybe Text) (Maybe Text) (Maybe [Int]) (Maybe Int) (Maybe Text) (Maybe Text) Int Int Editor
instance FromJSON SkillEdit where
  parseJSON v = withObject "SkillEdit" (\o -> SkillEdit <$> o .:? "name" <*> o .:? "desc" <*> o .:? "cost" <*> o .:? "cooldown" <*> o .:? "effect" <*> o .:? "target" <*> o .:? "power" .!= 0 <*> o .:? "duration" .!= 1 <*> parseJSON v) v

data NinjaEdit = NinjaEdit Text (Maybe Text) (Maybe Text) (Maybe Int) [SkillEdit]
instance FromJSON NinjaEdit where
  parseJSON = withObject "NinjaEdit" $ \o -> NinjaEdit <$> o .: "id" <*> o .:? "name" <*> o .:? "bio" <*> o .:? "hp" <*> o .:? "skills" .!= []

editorClass :: Text -> Class.Class
editorClass key = case key of
 "physical" -> Class.Physical
 "mental" -> Class.Mental
 "chakra" -> Class.Chakra
 "affliction" -> Class.Bane
 "ranged" -> Class.Ranged
 "melee" -> Class.Melee
 "bypass" -> Class.Bypassing
 "invisible" -> Class.Invisible
 "unique" -> Class.Unique
 _ -> Class.All

editSkill :: Int -> [SkillEdit] -> SkillEdit -> Skill.Skill -> Skill.Skill
editSkill index allEdits (SkillEdit title description costs cooldown effect target power duration editor) original =
  case effect of
    Nothing -> metadata
    Just "original" -> metadata
    _ -> metadata { Skill.effects = payload, Skill.start=beginnings, Skill.end=[]
                  , Skill.always=[], Skill.stunned=[], Skill.dur=channel
                  , Skill.require=requirements, Skill.charges=0, Skill.changes=const id
                  , Skill.classes=setFromList $ Class.All : (editorClass <$> editor.eClasses) ++ [Class.Invisible | editor.eInvisible] }
 where
  metadata = original { Skill.name=(if effect == Nothing || effect == Just "original" then original.name else fromMaybe original.name title), Skill.desc=fromMaybe original.desc description
                      , Skill.cost=fromMaybe original.cost $ costs >>= parseCost
                      , Skill.cooldown=maybe original.cooldown (max 0 . min 20) cooldown }
  parseCost [r,w,b,g,a] = Just $ fromList $ concat $ zipWith (\n c -> replicate (max 0 (min 9 n)) c) [r,w,b,g,a] [Blood,Gen,Nin,Tai,Rand]
  parseCost _ = Nothing
  turns = fromIntegral (max 1 (min 20 duration))
  channel = case editor.eChannel of
    "action" -> Channel.Action turns
    "control" -> Channel.Control turns
    "ongoing" -> Channel.Ongoing turns
    _ -> Channel.Instant
  marker i = "sandbox-technique-" ++ tshow i
  requirements = [Req.UserHas Req.AtLeast (max 1 $ min 10 editor.eUses) (marker editor.eRequires) | editor.eRequires > 0]
  names = [fromMaybe "Técnica" n | SkillEdit n _ _ _ _ _ _ _ _ <- allEdits]
  swaps = [Effect.Alternate fromName toName | SwapEdit slot technique <- editor.eSwaps, Just fromName <- [names !? (slot-1)], Just toName <- [names !? (technique-1)], slot >= 1, slot <= 4, technique > 4]
  beginnings = [To Skill.Self do
    Effects.addStacks' (setFromList [Class.Hidden,Class.Resource]) (if editor.eMarkTurns == 0 then Duration.Permanent else fromIntegral $ max 1 $ min 20 editor.eMarkTurns) (marker $ index+1) 1
    when (editor.eConsume && editor.eRequires > 0) $ Effects.removeStacks (marker editor.eRequires) (max 1 editor.eUses)
    unless (null swaps) $ Effects.apply (fromIntegral $ max 1 $ min 20 editor.eSwapTurns) "" swaps]
  recipes = if effect == Just "configured" then take 12 editor.eRecipes else [Recipe (fromMaybe "damage" effect) (fromMaybe "enemy" target) power duration "flat" "all" ""]
  payload = [To (destination target') (execute kind value dur unit cla label) | Recipe kind target' value dur unit cla label <- recipes]
  destination target' = case target' of
    "self" -> Skill.Self
    "ally" -> Skill.Ally
    "allies" -> Skill.Allies
    "enemies" -> Skill.Enemies
    _ -> Skill.Enemy
  execute :: Text -> Int -> Int -> Text -> Text -> Text -> RunConstraint ()
  execute kind value dur unit cla label = do
    nt <- P.nTarget
    let amount = max 0 (min 100 value)
        size = if unit == "currentPercent" then nt.health * amount `quot` 100 else amount
        span' = fromIntegral (max 1 (min 20 dur))
        mode = if unit == "percent" then Effect.Percent else Effect.Flat
        c = editorClass cla
        apply = Effects.apply span' label
    case kind of
      "damage" -> Combat.damage size
      "pierce" -> Combat.pierce size
      "afflict" -> Combat.afflict size
      "dot" -> apply [Effect.Afflict size]
      "heal" -> Combat.heal size
      "regen" -> apply [Effect.Heal size]
      "shield" -> Combat.defend span' size
      "reduce" -> apply [Effect.Reduce (singleton c) mode amount]
      "strengthen" -> apply [Effect.Strengthen (singleton c) mode amount]
      "weaken" -> apply [Effect.Weaken (singleton c) mode amount]
      "bleed" -> apply [Effect.Bleed (singleton c) mode amount]
      "stun" -> apply [Effect.Stun c]
      "invulnerable" -> apply [Effect.Invulnerable c]
      "reflect" -> apply [Effect.Reflect]
      "counter" -> TrapAction.trap span' label (Trigger.Counter c) (pure ())
      "copy" -> SkillAction.copyLast span'
      "deplete" -> ChakraAction.deplete (min 10 amount)
      "steal" -> ChakraAction.absorb (min 10 amount)
      "gain" -> ChakraAction.gain $ fromList $ replicate (min 10 amount) Rand
      "cure" -> Effects.cureAll
      "cureStun" -> Effects.cureStun
      "purge" -> Effects.purge
      "remove" -> Effects.remove label
      "prolong" -> Effects.prolong span' label
      "shorten" -> Effects.hasten span' label
      "ignore" -> apply [Effect.Enrage]
      "focus" -> apply [Effect.Focus]
      "expose" -> apply [Effect.Expose]
      "prepare" -> Effects.tag span' label
      _ -> pure ()

sandboxReset :: [Text] -> [NinjaEdit] -> Runtime ()
sandboxReset ids edits = do
  unless (length ids == 3 && length (nub ids) == 3 && length edits <= 6) $
    liftIO $ ioError $ userError "Equipe do sandbox inválida."
  opposing <- take 3 . toList <$> R.shuffle (V.fromList $ Character.ident <$> catalog)
  originals <- traverse resolve (ids ++ opposing)
  g <- Game.newWithChakras
  put $ Battle g (V.fromList $ zipWith make Slot.all originals) 1 ["Treino no sandbox."]
  refreshSharingan (const True)
 where
  resolve ident = case (find ((== ident) . Character.ident) catalog, find (\(NinjaEdit key _ _ _ _) -> key == ident) edits) of
    (Just c, Nothing) -> pure (c,100)
    (Just c, Just change) -> pure (customize c change)
    (Nothing, Just change@(NinjaEdit _ _ _ _ skills)) | "custom-" `isPrefixOf` ident && length skills >= 4 && length skills <= 20 ->
      pure $ customize (Character.Character "Novo ninja" 0 "" mempty (NN.fromNullableEx $ V.replicate 4 (NN.fromNullableEx $ V.singleton Skill.new)) Character.Original ident) change
    _ -> liftIO $ ioError $ userError "Ninja do sandbox não encontrado."
  customize c (NinjaEdit _ title bio hp edits') =
    (c { Character.name=fromMaybe c.name title, Character.bio=fromMaybe c.bio bio,
         Character.skills=NN.fromNullableEx $ V.fromList $ zipWith change [0..] (toList c.skills) }, maybe 100 (max 1 . min 100) hp)
   where
    change i variants = case edits' !? i of
      Nothing -> variants
      Just patch -> NN.fromNullableEx $ V.fromList $ case toList variants of
        firstSkill:rest -> Skill.withExtraClasses (editSkill i edits' patch firstSkill) : rest ++
          [Skill.withExtraClasses $ editSkill j edits' extra Skill.new | (j,extra@(SkillEdit _ _ _ _ _ _ _ _ config)) <- zip [0..] edits', j >= 4, config.eSlot == i+1]
        [] -> [Skill.new]
  make slot (c,hp) = (N.new slot c) { N.health=hp }


pay :: Chakras -> Chakras -> Maybe Chakras
pay cost pool = do
  let (generic, colored) = partition (== Rand) cost
  remaining <- C.checkedSpend colored pool
  let payment = fromList $ take (length generic) $ C.toDescendingList remaining
  guard $ length payment == length generic
  pure $ C.spend payment remaining

resetBattle :: [Text] -> Runtime ()
resetBattle requested = do
  opposing <- take 3 . toList <$> R.shuffle (V.fromList $ Character.ident <$> catalog)
  resetVersus requested opposing

resetVersus :: [Text] -> [Text] -> Runtime ()
resetVersus requested opposing = do
  let ids = if null requested then defaults else requested
  unless (length ids == 3 && length (nub ids) == 3) $ liftIO $ ioError $ userError "Escolha três personagens diferentes."
  unless (length opposing == 3 && length (nub opposing) == 3) $ liftIO $ ioError $ userError "Equipe adversária inválida."
  unless (all (`elem` (Character.ident <$> catalog)) (ids ++ opposing)) $ liftIO $ ioError $ userError "Personagem indisponível neste elenco."
  chars <- forM (ids ++ opposing) $ \ident -> case find ((== ident) . Character.ident) catalog of
    Nothing -> liftIO $ ioError $ userError "Personagem inválido."
    Just c -> pure c
  g <- Game.newWithChakras
  put $ Battle g (V.fromList $ zipWith makeFighter Slot.all chars) 1 ["Nova partida. Você começa com 1 energia; recebe energia por personagem vivo a cada turno."]
  refreshSharingan (const True)

makeFighter :: Slot.Slot -> Character.Character -> N.Ninja
makeFighter slot character = N.new slot character

decodePayment :: [Int] -> Maybe Chakras
decodePayment xs = do
  guard $ length xs == 4 && all (>= 0) xs && all (<= 10000) xs
  pure $ fromList $ concat $ zipWith replicate xs [Blood, Gen, Nin, Tai]

turnBattle :: [Move] -> [Int] -> Runtime ()
turnBattle = turnBattleFor False Player.A

poolFor :: Player.Player -> Game.Game -> Chakras
poolFor p g = if p == Player.A then fst g.chakra else snd g.chakra

viewSlot :: Player.Player -> Int -> Int
viewSlot p i = if p == Player.A then i else (i + 3) `mod` 6

turnBattleFor :: Bool -> Player.Player -> [Move] -> [Int] -> Runtime ()
turnBattleFor human p ms spending = do
  b <- get
  unless (Game.inProgress b.arena) $ liftIO $ ioError $ userError "A partida terminou. Inicie outra."
  unless (b.arena.playing == p) $ liftIO $ ioError $ userError "Aguarde o turno do adversário."
  unless (length ms <= 3 && length (nub $ actor <$> ms) == length ms) $ liftIO $ ioError $ userError "Use no máximo uma habilidade por personagem."
  let ns = Ninjas.processSkills <$> b.fighters
      validate m = do
        n <- ns V.!? viewSlot p m.actor
        guard $ m.actor >= 0 && m.actor < 3 && N.alive n
        sk <- n.skills V.!? m.skillIndex
        guard $ m.targetIndex >= 0 && m.targetIndex < 6
        target <- ns V.!? viewSlot p m.targetIndex
        guard $ any ((== target.slot) . N.slot) $ Req.targets ns n sk
        pure $ Context {skill = sk, user = n.slot, target = target.slot, new = True, continues = False}
  contexts <- case traverse validate ms of
    Nothing -> liftIO $ ioError $ userError "Ação indisponível ou alvo inválido."
    Just cs -> pure cs
  let totalCost = concatMap (Skill.cost . skill) contexts
      (generic, colored) = partition (== Rand) totalCost
      manualSpend = if null spending && null generic then Just mempty else decodePayment spending
      buy = do
        pool <- C.checkedSpend colored (poolFor p b.arena)
        spent <- manualSpend
        guard $ length spent == length generic
        C.checkedSpend spent pool
  remaining <- case buy of
    Nothing -> liftIO $ ioError $ userError "Distribua os recursos genéricos usando apenas as cores disponíveis."
    Just p -> pure p
  modify' $ \x -> x { journal = [] }
  P.alterGame $ Game.setChakra p remaining
  Engine.runTurn contexts
  g <- P.game
  when (not human && Game.inProgress g) AI.runTurn
  modify' $ \x -> x { roundNumber = x.roundNumber + 1 }

exchangeBattle :: [Int] -> Maybe Int -> Runtime ()
exchangeBattle = exchangeBattleFor Player.A

exchangeBattleFor :: Player.Player -> [Int] -> Maybe Int -> Runtime ()
exchangeBattleFor p spending choice = do
  b <- get
  unless (b.arena.playing == p) $ liftIO $ ioError $ userError "Aguarde seu turno para trocar energia."
  let result = do
        guard $ Game.inProgress b.arena
        kind <- choice
        guard $ kind >= 0 && kind < 4
        spent <- decodePayment spending
        guard $ length spent == 5
        pool <- C.checkedSpend spent (poolFor p b.arena)
        pure $ pool ++ singleton ([Blood, Gen, Nin, Tai] Base.!! kind)
  case result of
    Nothing -> liftIO $ ioError $ userError "A troca exige cinco energias disponíveis para receber uma energia da cor escolhida."
    Just pool -> P.alterGame $ Game.setChakra p pool

skillTags :: Skill.Skill -> [Text]
skillTags s = [label | (cls,label) <- [(Class.Physical,"Física"),(Class.Chakra,"Chakra"),(Class.Bane,"Aflição"),(Class.Mental,"Mental"),(Class.Melee,"Corpo a corpo"),(Class.Ranged,"À distância"),(Class.Unique,"Única"),(Class.Invisible,"Oculta")], cls `elem` s.classes] ++ [case s.dur of Channel.Action _ -> "Ação"; Channel.Control _ -> "Controle"; Channel.Ongoing _ -> "Contínua"; _ -> "Instantânea"]

channelDuration :: Channel.Channeling -> Duration.Duration
channelDuration (Channel.Action d) = d
channelDuration (Channel.Control d) = d
channelDuration (Channel.Ongoing d) = d
channelDuration _ = 1

catalogSkill :: Int -> Skill.Skill -> Value
catalogSkill i s = object ["index" .= i,"name" .= s.name,"desc" .= s.desc,"cost" .= s.cost,"requirements" .= s.require, "channel" .= tshow s.dur, "baseCooldown" .= s.cooldown,"classTags" .= skillTags s,"areaEnemies" .= (Skill.Enemies `elem` Skill.targets s)]
charValue :: Character.Character -> Value
charValue c = object ["id" .= c.ident,"name" .= Character.format c,"bio" .= c.bio,"side" .= ("killers" :: Text),"forms" .= ((\variants -> uncurry catalogSkill <$> zip [0..] (toList variants)) <$> toList c.skills),"skills" .= (uncurry catalogSkill <$> zip [0..] (toList $ unsafeHead <$> c.skills))]
snapshot :: Battle -> Value
snapshot = snapshotFor Player.A

snapshotFor :: Player.Player -> Battle -> Value
snapshotFor p b = object
  [ "round" .= b.roundNumber, "energy" .= poolFor p b.arena
  , "yourTurn" .= (b.arena.playing == p), "activePlayer" .= (if b.arena.playing == Player.A then (0 :: Int) else 1)
  , "winner" .= (if null b.arena.victor then ("" :: Text) else if p `elem` b.arena.victor then "Você venceu" else "O adversário venceu")
  , "log" .= b.journal, "roster" .= (charValue <$> catalog), "rosterVersion" .= (2 :: Int), "survivorsEnabled" .= False
  , "fighters" .= (fighterValue . Slot.index ns . (Slot.all Base.!!) . viewSlot p <$> [0..5]) ]
  where
    ns = Ninjas.processSkills <$> b.fighters
    fighterValue :: N.Ninja -> Value
    fighterValue n = object
      [ "slot" .= viewSlot p (Slot.toInt n.slot), "id" .= n.character.ident, "name" .= Character.format n.character
      , "hp" .= n.health
      , "effects" .= (((\s -> effectValue s.name s.skill s.dur (tshow s.effects)) <$> filter (\st -> Class.Hidden `notElem` st.classes && (viewSlot p (Slot.toInt st.user) < 3 || Class.Invisible `notElem` st.classes)) n.statuses) ++ ((\t -> effectValue (t.name ++ if Class.Invisible `elem` t.skill.classes then " (oculta)" else "") t.skill t.dur "Armadilha conhecida apenas pelo seu criador.") <$> filter (\t -> viewSlot p (Slot.toInt t.user) < 3 || not (Class.Invisible `elem` t.skill.classes)) n.traps) ++ channelEffects n)
      , "defenses" .= ((\d -> effectValue d.skill.name d.skill d.dur ("Proteção: " ++ tshow d.amount)) <$> (n.defense ++ n.barrier))
      , "skills" .= ((\(i,s) -> object
          [ "index" .= i, "name" .= s.name, "desc" .= s.desc, "cost" .= s.cost
          , "cooldown" .= fromMaybe 0 (HM.lookup (Skill.key s) n.cooldowns)
          , "requirements" .= s.require, "channel" .= tshow s.dur, "baseCooldown" .= s.cooldown, "classes" .= show s.classes, "classTags" .= skillTags s, "areaEnemies" .= (Skill.Enemies `elem` Skill.targets s)
          , "targets" .= (viewSlot p . Slot.toInt . N.slot <$> toList (Req.targets ns n s))
          , "affordable" .= isJust (pay s.cost $ poolFor p b.arena)
          ]) <$> zip [0 :: Int ..] (toList n.skills))
      ]
    channelEffects n = [effectValue ch.skill.name ch.skill (channelDuration ch.dur) "Habilidade em andamento."
      | caster <- toList ns, ch <- caster.channels
      , let area = Skill.Enemies `elem` Skill.targets ch.skill && (Slot.toInt n.slot `quot` 3 /= Slot.toInt caster.slot `quot` 3)
      , n.slot == caster.slot || n.slot == ch.target || area
      , not $ any (\st -> st.skill.name == ch.skill.name && st.skill.owner == ch.skill.owner) n.statuses]
    effectValue :: Text -> Skill.Skill -> Duration.Duration -> Text -> Value
    effectValue label s duration mechanics = object
      [ "name" .= label, "skill" .= s.name, "ownerId" .= (Slot.index ns s.owner).character.ident
      , "desc" .= s.desc, "classTags" .= skillTags s, "mechanics" .= mechanics, "permanent" .= (duration == Duration.Permanent)
      , "turns" .= (max 1 $ (abs (Duration.sync duration) + 1) `quot` 2)
      ]

dispatch :: Request -> Runtime ()
dispatch r = do
 unless (r.player == 0 || r.player == 1) $ liftIO $ ioError $ userError "Jogador inválido."
 let p = if r.player == 0 then Player.A else Player.B
 case r.command of
  "reset" -> maybe (resetBattle r.team) (sandboxReset r.team) r.sandbox
  "turn" -> turnBattle r.moves r.payment
  "playerTurn" -> turnBattleFor True Player.A r.moves r.payment
  "cpuTurn" -> do
    g <- P.game
    unless (Game.inProgress g && g.playing == Player.B) $ liftIO $ ioError $ userError "A CPU não pode jogar agora."
    AI.runTurn
    modify' $ \b -> b {roundNumber=b.roundNumber+1}
  "exchange" -> exchangeBattle r.payment r.exchangeTo
  "humanReset" -> resetVersus r.team r.opponentTeam
  "humanTurn" -> turnBattleFor True p r.moves r.payment
  "humanExchange" -> exchangeBattleFor p r.payment r.exchangeTo
  "surrender" -> P.alterGame (Game.forfeit p)
  "state" -> pure ()
  _ -> liftIO $ ioError $ userError "Comando inválido."

rulesTests :: Runtime [Text]
rulesTests = do
  resetBattle []
  let rich = P.alterGame $ Game.setChakra Player.A (C.each 100) . Game.setChakra Player.B (C.each 100)
      check :: Text -> Bool -> Runtime ()
      check label ok=unless ok $ liftIO $ ioError $ userError $ unpack label
      first=unsafeHead Slot.all
      foe=Slot.all Base.!! 3
      points name=do n<-P.ninja first; pure $ N.amount (ID.ID first first name) n
      versus id=resetVersus [id,"sasuke-uchiha","sakura-haruno"] ["naruto-uzumaki","shino-aburame","sakura-haruno"] >> rich
  versus "classic-shinobi-alliance-kankuro-s"
  turnBattleFor True Player.A [Move 0 0 0] []
  turnBattleFor True Player.B [Move 0 0 3] []
  hp<-N.health <$> P.ninja first
  stacks<-points "Mastery Points"
  check "Kankuro must consume mastery even when reduction blocks all damage" (hp==100 && stacks==4)
  turnBattleFor True Player.A [Move 0 1 3] [2,0,0,0]
  enemyHp<-N.health <$> P.ninja foe
  check "Kankuro area damage scales with remaining mastery" (enemyHp==80)
  turnBattleFor True Player.B [Move 0 0 3] []
  turnBattleFor True Player.A [Move 0 2 0] [1,0,0,0]
  shield<-N.total N.defense <$> P.ninja first
  check "Kankuro defense scales and discounted generic cost is payable" (shield==30)
  versus "classic-fuuton-naruto-s"
  turnBattleFor True Player.A [Move 0 2 0] [1,0,0,0]
  turnBattleFor True Player.B [Move 0 0 3] []
  hp2<-N.health <$> P.ninja first
  clones<-points "Wind Clones"
  check "Wind clones reduce damage and lose one clone per new damaging action" (hp2==90 && clones==4)
  turnBattleFor True Player.A [Move 0 0 3] []
  clones2<-points "Wind Clones"
  check "Wind attack consumes two clones" (clones2==2)
  versus "classic-kisame-body-double-s"
  turnBattleFor True Player.A [Move 0 2 3] [1,0,0,0]
  before<-length . poolFor Player.A <$> P.game
  turnBattleFor True Player.B [Move 1 0 3] [1,0,0,0]
  after<-length . poolFor Player.A <$> P.game
  check "Water field blocks one stolen chakra" (after==before)
  pure ["Elenco carregado","Kankuro: impacto sem dano, escala e custo","Naruto Fuuton: clones e consumo","Kisame: proteção contra roubo"]
main :: IO ()
main = do
  args <- getArgs
  if args == ["--self-test"] then do
    gen <- createSystemRandom
    (checks,_) <- runReaderT (runStateT rulesTests (Battle Game.new V.empty 1 [])) gen
    BL.putStrLn $ encode $ object ["checks" .= checks, "passed" .= True]
  else runServer

runServer :: IO ()
runServer = do
  hSetBuffering stdout LineBuffering
  hSetBuffering stdin LineBuffering
  gen <- createSystemRandom
  let emptyBattle = Battle Game.new V.empty 1 []
  (_,initial) <- runReaderT (runStateT (resetBattle []) emptyBattle) gen
  loop gen initial
  where
    loop gen b = do
      done <- isEOF
      unless done do
        line <- BS.getLine
        case eitherDecodeStrict' line of
          Left err -> BL.putStrLn $ encode $ object ["error" .= err]
          Right req -> do
            result <- try (runReaderT (runStateT (dispatch req) b) gen) :: IO (Either SomeException ((), Battle))
            case result of
              Left err -> do
                BL.putStrLn $ encode $ object ["error" .= Base.show err]
                loop gen b
              Right (_,next) -> do
                BL.putStrLn $ encode $ snapshotFor (if req.player == 0 then Player.A else Player.B) next
                loop gen next







