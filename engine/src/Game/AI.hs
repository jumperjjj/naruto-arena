module Game.AI (runTurn) where

import ClassyPrelude

import Control.Monad.Trans.Maybe (MaybeT(..), hoistMaybe)

import           Class.Hook (MonadHook)
import           Class.Play (MonadGame)
import qualified Class.Play as P
import           Class.Random (MonadRandom)
import qualified Class.Random as R
import           Game.Model.Chakras (Chakra(..), Chakras)
import qualified Game.Model.Chakras as Chakras
import           Game.Model.Context (Context(Context))
import qualified Game.Model.Context as Context
import           Game.Model.Game (Game(Game))
import qualified Game.Model.Game as Game
import qualified Game.Model.Player as Player
import qualified Game.Engine as Engine
import           Game.Model.Ninja (Ninja)
import qualified Game.Model.Ninja as N
import qualified Game.Model.Requirement as Requirement
import qualified Game.Model.Skill
import           Game.Model.Slot (Slot)
import           Util ((!?))

targetOptions :: [Ninja] -> Ninja -> Int -> [Context]
targetOptions ns n i =
    [ makeOption skill target | skill  <- maybeToList $ n.skills !? i,
                                target <- Requirement.targets ns n skill ]
  where
    makeOption skill target = Context
        { new       = True
        , user      = n.slot
        , skill
        , target    = target.slot
        , continues = False
        }

skillOptions :: [Ninja] -> Ninja -> [[Context]]
skillOptions ns n = filter (not . null)
    $ targetOptions ns n <$> [0..length n.skills - 1]

-- | The higher this is, the more likely AI is to attack the vendetta target.
vendettaRatio :: Int
vendettaRatio = 5

run :: ∀ m. (MonadGame m, MonadRandom m) => Chakras -> Slot -> Ninja -> m (Maybe Context)
run pool vendetta n = runMaybeT do
    ninjas <- toList <$> P.ninjas
    let candidates = [act | act <- concat (skillOptions ninjas n), isJust $ spendWithExchange act.skill.cost pool]
        score act = case find ((== act.target) . N.slot) ninjas of
          Nothing -> 0
          Just target ->
            let description = toLower act.skill.desc
                healing = any (`isInfixOf` description) ["restores", "heals", "restore", "cura"]
                offensive = act.target /= n.slot && (N.slot target < N.slot n)
                attack = any (`isInfixOf` description) ["damage", "dano", "steal", "deplete"]
                defense = "invulnerable" `isInfixOf` description
            in if healing then (100 - target.health) * 2 - 35
               else if offensive then 35 + (100 - target.health) + (if attack then 25 else 0) + (if act.target == vendetta then 8 else 0)
               else if defense then (if n.health <= 40 then 70 else 3)
               else 28
        best = foldl' max 0 (score <$> candidates)
    MaybeT $ R.choose [act | act <- candidates, score act > 0, score act >= best - 5]

-- | Returns @Nothing@ only if all enemies are dead.
chooseVendetta :: ∀ m. (MonadGame m, MonadRandom m) => m (Maybe Slot)
chooseVendetta = do
    ninjas <- P.allies Player.A
    ninja  <- R.choose $ filter N.alive ninjas
    let v   = N.slot <$> ninja
    P.alterGame $ Game.setVendetta v
    return v

-- | Returns @Nothing@ only if all enemies are dead.
getVendetta :: ∀ m. (MonadGame m, MonadRandom m) => m (Maybe Slot)
getVendetta = do
    Game{vendetta} <- P.game
    fromMaybe <$> chooseVendetta <*> runMaybeT do
        v     <- hoistMaybe vendetta
        ninja <- lift $ P.ninja v
        guard $ N.alive ninja
        return vendetta


runTurn :: ∀ m. (MonadGame m, MonadHook m, MonadRandom m) => m ()
runTurn = do
    vendetta <- getVendetta
    case vendetta of
        Nothing -> Engine.runTurn [] -- All enemies are dead
        Just v  -> do
            ninjas   <- P.allies Player.B
            actors <- R.shuffle $ fromList @(Vector _) $ filter N.alive $ toList ninjas
            Game{chakra = (_, chakras)} <- P.game
            (actions, remaining) <- foldM (chooseAction v) ([], chakras) (toList actors)
            P.alterGame $ Game.setChakra Player.B remaining
            Engine.runTurn $ reverse actions
  where
    chooseAction vendetta (actions, pool) ninja = do
        choice <- run pool vendetta ninja
        case choice >>= (\action -> (action,) <$> spendWithExchange action.skill.cost pool) of
            Nothing -> pure (actions, pool)
            Just (action, remaining) -> pure (action : actions, remaining)

spendWithExchange :: Chakras -> Chakras -> Maybe Chakras
spendWithExchange cost gameChakras = do
    let (rands, nonrands) = partition (== Rand) cost
    afterNonrand <- Chakras.checkedSpend nonrands gameChakras
    let exchangeForRandoms = fromList $ take (length rands)
            $ Chakras.toDescendingList afterNonrand
    guard $ length exchangeForRandoms == length rands
    return $ Chakras.spend exchangeForRandoms afterNonrand
