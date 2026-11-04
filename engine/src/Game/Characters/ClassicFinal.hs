{-# LANGUAGE OverloadedLists #-}
module Game.Characters.ClassicFinal (configure,names,rotateSharingan) where
import Game.Characters.Import
import qualified Game.Model.Skill as S
import qualified Game.Model.Ninja as N
import qualified Game.Model.Character as Character
import qualified Game.Model.Destructible as D
import qualified Class.Play as P
import qualified Class.Parity as Parity
import qualified Game.Engine.Ninjas as Ninjas
import qualified Game.Model.Effect as Effect
import qualified Game.Model.Status as Status
import qualified Data.HashMap.Strict as HM
import qualified Class.Random as R
import qualified Game.Engine.Chakra as Chakra
import qualified Game.Model.Game as Game
import qualified Game.Model.Context as Context
import qualified Game.Model.Chakras as C
import qualified Game.Action as Action
import qualified Game.Engine.Cooldown as Cooldown
import qualified Game.Model.ID as ID
import qualified Data.List as List

names :: [Text]
names=["Yahiko (S)","Shinobi Alliance Tenten (S)","Shinobi Alliance Bee (S)","Edo Tensei Mangetsu (S)","Edo Tensei Tayuya (S)","Shinobi Alliance Kakashi (S)","Shinobi Alliance Kiba (S)","Susanoo Sasuke (S)","True Art Deidara (S)","Shinobi Alliance Shikamaru (S)","Shinobi Alliance Chouji (S)","Shinobi Alliance Ino (S)","Shinobi Alliance Mei (S)","Edo Tensei Yugito (S)","Edo Tensei Roshi (S)","Female Animal Path Pein (S)","White Zetsu (S)","Edo Tensei Itachi (S)","Edo Tensei Fuu (S)","Edo Tensei Yagura (S)"]

configure :: Text -> Int -> Skill -> Skill
configure name index s = augment $ case (name,index) of
  ("Yahiko (S)",0) -> s {S.effects=[To Enemies $ damage 25,To Allies $ apply 1 skillName [Heal 5,Invulnerable Affliction]]}
  ("Yahiko (S)",1) -> s
    {S.classes=s.classes ++ [Invisible,Soulbound],S.require=[TargetHas AtMost 0 "Water Pillar"]
    ,S.effects=[To XAlly do
        owner <- user slot
        apply Permanent skillName [Redirect owner]
        trap Permanent skillName (OnHarmed All) do
          remove "Water Pillar"
          removeTrap "Water Pillar"
          heal 20
          defend Permanent 15]}
  ("Yahiko (S)",2) -> s
    {S.changes = \n skill -> if n.health<=25 then skill else skill {S.require=[Unusable]}
    ,S.effects=[To XAlly do
        apply 2 skillName [Strengthen [All] Flat 15,Focus]
        gain [Rand]
        bomb 1 "Final Command Chakra" [] [To Expire $ asAction $ gain [Rand]]
      ,To Self killHard]}
  ("Yahiko (S)",3) -> s
    {S.effects=[To Self $ apply 1 skillName [Reduce [All,Affliction] Flat 15,Invulnerable Affliction]
               ,To XAllies do owner <- user slot; apply 1 skillName [Redirect owner]]}
  ("Shinobi Alliance Tenten (S)",0) -> s
    {S.effects=[To Enemies do
                    damage 15
                    afflict 15
                    bomb 1 skillName [] [To Expire $ asAction $ apply 3 "Coil of Fire" [Afflict 5]]
               ,To Self $ tag 1 "Bashousen Fire"]}
  ("Shinobi Alliance Tenten (S)",1) -> s
    {S.classes=s.classes ++ [Invisible]
    ,S.effects=[To Allies $ apply 1 skillName [ReflectAll NonMental],To Self $ tag 1 "Bashousen Wind"]}
  ("Shinobi Alliance Tenten (S)",2) -> s
    {S.effects=[To Enemy do
        afflict 15
        whenM (user has "Bashousen Fire") $ apply Permanent skillName [Afflict 5]
      ,To Ally do
        defend Permanent 15
        whenM (user has "Bashousen Wind") $ applyWith [Invisible] 1 skillName [ReflectAll NonMental]]}
  ("Shinobi Alliance Bee (S)",0) -> s
    {S.require=[TargetHas AtMost 0 "Sting Mark"]
    ,S.effects=[To Enemy do pierce 15; tag 3 "Sting Mark"
               ,To Self do
                   trap 1 "Sting Physical" (Counter Physical) $ removeTrap "Sting Chakra"
                   trap 1 "Sting Chakra" (Counter Chakra) $ removeTrap "Sting Physical"]}
  ("Shinobi Alliance Bee (S)",1) -> s
    {S.effects=[To Enemies $ whenM (target has "Sting Mark") do leech 15 heal; stealColor [Blood,Nin]]}
  ("Shinobi Alliance Bee (S)",2) -> s
    {S.effects=[To Self do
        defend' Permanent 20 [Heal 10,Alternate "Hachibi Chakra Cloak" "Fatal Sting"]
        onBreak $ asAction $ targeting Allies $ apply 1 "Cloak Broken" [Strengthen [NonBane] Flat 5]]}
  ("Shinobi Alliance Bee (S)",4) -> s
    {S.effects=[To Enemy do
        extra <- 15 `bonusIf` target has "Sting Mark"
        pierce (25+extra)
        apply 1 skillName [LimitOutgoing 10]]}
  ("Edo Tensei Mangetsu (S)",0) -> s
    {S.effects=[To Enemy do
        sword <- user amount "Mist Sword"
        leech (if sword==1 then 30 else 20) heal
        case sword of
          2 -> targeting Self $ defend Permanent 10
          3 -> absorb 1
          4 -> apply 1 skillName [Stun NonMental]
          5 -> apply Permanent skillName [Afflict 5]
          6 -> demolishAll >> pierce 15
          7 -> targeting XEnemies $ afflict 20
          _ -> pure ()
      ,To Self do
        choice <- R.choose ([Nothing,Just Physical,Just Chakra,Just Mental,Just Bane] :: [Maybe Class])
        forM_ (join choice) $ \cls -> apply 1 skillName [Invulnerable cls]]}
  ("Edo Tensei Mangetsu (S)",1) -> s {S.charges=5,S.effects=[To Self $ apply Permanent skillName [Heal 2]]}
  ("Edo Tensei Mangetsu (S)",2) -> s
    {S.require=[UserHas AtMost 0 "Mist Sword"]
    ,S.dur=Ongoing Permanent,S.effects=[To Self do
        sword <- R.range (1,7)
        remove "Mist Sword"
        addStacks "Mist Sword" sword]}
  ("Edo Tensei Tayuya (S)",0) -> s
    {S.dur=Action 3,S.start=[To Self $ tag 3 "Melody Bonus"
                           ,To Enemies $ trap 3 skillName (OnAttack All) $ leech 5 heal]
    ,S.effects=[To Enemies $ afflict 5]}
  ("Edo Tensei Tayuya (S)",1) -> s
    {S.effects=[To Enemy do
        improved <- user has "Melody Bonus"
        if improved then leech 20 heal >> stealColor [Nin,Blood] else afflict 20]}
  ("Edo Tensei Tayuya (S)",2) -> s
    {S.classes=s.classes ++ [Invisible]
    ,S.effects=[To Ally $ trapFrom 1 skillName (Counter Harmful) do damage 5; apply 1 skillName [Stun Harmful]]}
  ("Shinobi Alliance Kakashi (S)",0) -> s
    {S.effects=[To Enemy do demolishAll; pierce 15; leech 5 heal; cableDrain
               ,To Self $ tag 1 "Heavy Attack Cost"]}
  ("Shinobi Alliance Kakashi (S)",1) -> s
    {S.classes=s.classes ++ [Uncounterable,Unreflectable]
    ,S.effects=[To Enemy do
        extra <- 10 `bonusIf` user has "Kunai Kill"
        pierce (40+extra)
        cableDrain
        unlessM (target alive) $ targeting Self do
          tag 1 "Kunai Kill"
          bomb 1 "Kunai Reset" [] [To Expire $ asAction $ resetCooldown "Lightning-Infused Kunai"]]
    ,S.changes=changeWith "Heavy Attack Cost" (setCost [Nin,Rand])
           `also` changeWith "Kunai Kill" (setCost [Rand,Rand])}
  ("Shinobi Alliance Kakashi (S)",2) -> s
    {S.effects=[To Self do
        apply 3 skillName [Reduce [All] Flat 15]
        trapFrom 3 skillName (OnHarmed NonMental) $ asAction $ pierce 10
      ,To Enemies $ trap 3 skillName (OnAttack All) $ addStack "Lightning Cable Mark"]}
  ("Shinobi Alliance Kiba (S)",0) -> s
    {S.effects=[To Enemy do
        extra <- 10 `bonusIf` user has "Three Headed Wolf"
        pierce (30+extra)
        apply 1 skillName [Weaken [NonBane] Flat 10]]}
  ("Shinobi Alliance Kiba (S)",1) -> s
    {S.effects=[To Allies cleanseWolf
               ,To Enemies $ trap 3 skillName OnHarm $ asAction do
                   pierce 5
                   apply Permanent skillName [Bleed [Physical] Flat 5]
               ,To Self $ apply 3 skillName [Alternate "Three Headed Wolf" "Tail Rotating Fang"]]}
  ("Shinobi Alliance Kiba (S)",2) -> s
    {S.effects=[To XAlly tactics,To Self tactics]}
  ("Shinobi Alliance Kiba (S)",4) -> s
    {S.effects=[To Enemy do pierce 45; apply Permanent skillName [Weaken [Physical] Flat 5]
               ,To Self do apply 1 skillName [Invulnerable Physical]; apply Permanent skillName [Weaken [Physical] Flat 5]]}
  ("Susanoo Sasuke (S)",0) -> s
    {S.effects=[To Self do
        defend' Permanent 50 [Alternate "Sasuke Susano'o" "Sasuke Mangekyo Sharingan"]
        onBreak $ asAction do
          remove "Sasuke Mangekyo Sharingan"
          apply 2 "Susanoo Broken" [Stun All]]}
  ("Susanoo Sasuke (S)",1) -> s
    {S.require=[UserDefense AtLeast 1 "Sasuke Susano'o"]
    ,S.effects=[To Enemy do
        points <- user defensePoints
        demolishAll
        pierce (20+5*(points `quot` 10))]}
  ("Susanoo Sasuke (S)",2) -> s
    {S.require=[UserDefense AtLeast 1 "Sasuke Susano'o"]
    ,S.classes=s.classes ++ [Unremovable]
    ,S.effects=[To Enemy do
        apply Permanent skillName [Afflict 2]
        trap Permanent skillName (OnAction All) do
          stacks <- target amount "Amaterasu Doublings"
          addStack "Amaterasu Doublings"
          apply Permanent "Amaterasu Growth" [Afflict (2*2^(min 20 stacks))]
        trap Permanent skillName OnDeath $ targeting Self $ resetCooldown "Spreading Amaterasu"]}
  ("Susanoo Sasuke (S)",4) -> s
    {S.effects=[To Self do
        remove "Sasuke Mangekyo Sharingan"
        apply Permanent skillName [Reduce [All,Affliction] Percent 25]
        resetCooldown "Spreading Amaterasu"]}
  ("True Art Deidara (S)",0) -> s
    {S.dur=Ongoing Permanent
    ,S.start=[To Self do defend Permanent 15; onBreak $ cancelChannel "Clay Dolls"]
    ,S.effects=[To REnemy do damage 10; apply Permanent skillName [Bleed [NonBane] Flat 5]]}
  ("True Art Deidara (S)",1) -> s
    {S.effects=[To Self do
        defend 3 20
        apply 3 skillName [Alternate "C2: Dragon" "Dragon Missile"]
      ,To Enemies $ trap 3 skillName OnHarm $ asAction $ pierce 10]}
  ("True Art Deidara (S)",2) -> s
    {S.dur=Ongoing Permanent
    ,S.effects=[To Enemy do
        ticks <- target amount "Karura Ticks"
        afflict (3*2^(min 20 ticks))
        addStack "Karura Ticks"]}
  ("True Art Deidara (S)",4) -> s
    {S.classes=s.classes ++ [Bypassing],S.effects=[To Enemy $ damage 25]}
  ("True Art Deidara (S)",5) -> s
    {S.require=[UserHas AtLeast 5 "Deidara Uses"]
    ,S.effects=[To Enemies $ pierce 40,To Self killHard]}
  ("Shinobi Alliance Shikamaru (S)",0) -> s
    {S.effects=[To Enemy do
        extra <- 15 `bonusIf` user has "Shadow Range"
        pierce (30+extra)
        apply 1 skillName [Stun Physical,Stun Mental,Stun Bane]
        trap 1 skillName OnNoAction $ asAction $ pierce 15]}
  ("Shinobi Alliance Shikamaru (S)",1) -> s
    {S.classes=s.classes ++ [Invisible]
    ,S.effects=[To Self $ apply 1 "Shadow Range" [Invulnerable Affliction,Reduce [All,Affliction] Percent 100,Alternate "Tatical Range Increase" "Tatical Shadow Bind"]
               ,To Enemies $ trap 1 skillName (OnAction All) $ tag 1 "Shadow Target"]}
  ("Shinobi Alliance Shikamaru (S)",2) -> s
    {S.effects=[To XAlly do
        ally <- target slot
        apply 3 skillName [Snare (-1)]
        targeting Self $ trap 3 skillName (OnAction All) $
          P.withTarget ally $ apply 1 skillName [Reduce [All,Affliction] Percent 100,Invulnerable Affliction]]}
  ("Shinobi Alliance Shikamaru (S)",4) -> s
    {S.dur=Control 2,S.start=[To Enemies $ whenM (target has "Shadow Target") do
        damage 30
        control [Stun Physical,Stun Chakra]]}
  ("Shinobi Alliance Chouji (S)",0) -> s
    {S.classes=s.classes ++ [Uncounterable,Unreflectable]
    ,S.effects=[To Self $ apply 1 skillName [Enrage],To Enemy $ damage 30,To Self $ addStacks "Butterfly Debt" 2]}
  ("Shinobi Alliance Chouji (S)",1) -> s
    {S.dur=Action 2
    ,S.effects=[To Enemy $ damage 15,To Self do
        trap 1 skillName (CounterAll Physical) doNothing
        trap 1 skillName (CounterAll Chakra) doNothing
        addStack "Butterfly Debt"]}
  ("Shinobi Alliance Chouji (S)",2) -> s
    {S.dur=Ongoing Permanent
    ,S.start=[To Self $ apply Permanent skillName [Alternate "Butterfly Control" "Super-Punch"]]
    ,S.effects=[To Self $ removeStack "Butterfly Debt"]}
  ("Shinobi Alliance Chouji (S)",4) -> s
    {S.classes=s.classes ++ [Uncounterable,Unreflectable]
    ,S.effects=[To Self cureAll,To Enemy $ damage 30,To Self $ addStacks "Butterfly Debt" 2]}
  ("Shinobi Alliance Ino (S)",0) -> s
    {S.classes=s.classes ++ [Invisible]
    ,S.effects=[To Enemy do
        trap 1 skillName (Countered Harmful) $ copyLast 2
        bomb 1 skillName [] [To Expire $ asAction $ pierce 15]]}
  ("Shinobi Alliance Ino (S)",1) -> s
    {S.classes=s.classes ++ [Invisible,Uncounterable,Unreflectable,Bypassing]
    ,S.effects=[To Enemies $ apply 4 skillName [Unreduce 15,Build (-15),Reveal]]}
  ("Shinobi Alliance Ino (S)",2) -> s
    {S.classes=s.classes ++ [Invisible,Soulbound]
    ,S.effects=[To XAllies $ apply 3 skillName [Enrage]]}
  ("Shinobi Alliance Mei (S)",0) -> s
    {S.effects=[To Enemy do damage 25; apply 1 skillName [Stun All],To XEnemies $ apply 1 skillName [Exhaust [All]]]}
  ("Shinobi Alliance Mei (S)",1) -> s
    {S.classes=s.classes ++ [Soulbound]
    ,S.effects=[To Enemies do
        afflict 10
        apply Permanent "Acid Mud Weakness" [Weaken [NonBane] Flat 5]
        trap Permanent skillName (OnAttack NonAffliction) $ removeStack "Acid Mud Weakness"
        trap Permanent skillName OnStunned $ apply Permanent "Acid Mud Weakness" [Weaken [NonBane] Flat 5]]}
  ("Shinobi Alliance Mei (S)",2) -> s
    {S.classes=s.classes ++ [Invisible]
    ,S.effects=[To Enemy $ trap 1 skillName (OnAction All) do
        previous <- target N.lastSkill
        forM_ previous $ \skill -> case filter (`elem` skill.classes) [Bane,Physical,Chakra,Mental] of
          primary:_ -> apply 1 skillName [Stun primary]
          [] -> pure ()]}
  ("Edo Tensei Yugito (S)",0) -> s
    {S.effects=[To Enemy do amount <- nibiDamage; damage amount; apply 1 skillName [Stun NonMental]]}
  ("Edo Tensei Yugito (S)",1) -> s
    {S.effects=[To Enemy do amount <- nibiDamage; damage amount; deplete1 [Tai]]}
  ("Edo Tensei Yugito (S)",2) -> s
    {S.effects=[To Enemy do amount <- nibiDamage; demolishAll; pierce amount; executeAt 10]}
  ("Edo Tensei Yugito (S)",3) -> s
    {S.effects=[To Self do remove "Nibi Streak"; apply 1 skillName [Invulnerable All]]}
  ("Edo Tensei Roshi (S)",0) -> s
    {S.effects=[To Enemy $ afflict 30,To RXEnemy $ afflict 10]
    ,S.changes=changeWith "Magma Field" (\skill -> skill {S.cost=C.spend [Rand] skill.cost})}
  ("Edo Tensei Roshi (S)",1) -> s
    {S.effects=[To Self do
        apply 4 skillName [Reduce [All,Affliction] Flat 15]
        trapFrom 4 skillName (OnHarmed NonMental) $ asAction $ afflict 10]}
  ("Edo Tensei Roshi (S)",2) -> s
    {S.dur=Ongoing 3,S.start=[To Self $ tag 3 "Magma Field",To Allies $ apply 3 "Magma Chakra Guard" [ChakraGuard 1]]
    ,S.effects=[To Self $ unlessM (Context.new <$> P.context) $ roshiPulse False]}
  ("Female Animal Path Pein (S)",0) -> s
    {S.classes=s.classes ++ [Bypassing,Uncounterable,Unreflectable]
    ,S.changes=changePer "Animal Count" (\count skill -> setCost (fromList (Nin:replicate count Rand)) skill)
    ,S.effects=[To Self summonAnimals]}
  ("Female Animal Path Pein (S)",1) -> prepareAnimal s "Buffalo" 1
  ("Female Animal Path Pein (S)",2) -> prepareAnimal s "Centipede" 2
  ("Female Animal Path Pein (S)",3) -> prepareAnimal s "Crab" 3
  ("Female Animal Path Pein (S)",4) -> prepareAnimal s "Rhino" 1
  ("White Zetsu (S)",0) -> s
    {S.dur=Ongoing Permanent,S.require=[UserHas AtMost 0 "White Host"]
    ,S.start=[To Self do
        applyWith [Unremovable] Permanent "White Host" [Disable (Any Invulnerable)]
        trap Permanent skillName OnStunned $ apply 1 skillName [Reduce [All,Affliction] Flat 15]]
    ,S.effects=[To Self zetsuGrowth]}
  ("White Zetsu (S)",1) -> s
    {S.classes=s.classes ++ [Uncounterable]
    ,S.changes=changePer "Clone Stock" (\stock skill -> if stock>=3 then setCost [Rand] skill else skill {S.require=[Unusable]})
    ,S.effects=[To Enemy do
        stock <- user amount "Clone Stock"
        pierce (if stock<3 then 0 else 5+20*min 3 (stock `quot` 3))]}
  ("White Zetsu (S)",2) -> s
    {S.dur=Ongoing 4
    ,S.start=[To Self $ apply 4 skillName [Alternate "Mass Reproduction" "Parasitic Grab"]]
    ,S.effects=[To REnemy $ damage 10,To RAlly $ apply 1 skillName [Reduce [All] Flat 10]]}
  ("White Zetsu (S)",3) -> s
    {S.effects=[To Enemies $ apply 2 skillName [Alone,Bleed [All] Flat 5]]}
  ("White Zetsu (S)",4) -> s
    {S.effects=[To Enemy do
        zetsu <- user slot
        apply 1 skillName [Taunt zetsu]
        apply 2 "Parasitic Vulnerability" [Bleed [All] Percent 50]]}
  ("Edo Tensei Itachi (S)",0) -> s
    {S.effects=[To Enemies do
        afflict 10
        trap 1 skillName OnHarm $ asAction $ afflict 10]}
  ("Edo Tensei Itachi (S)",1) -> s
    {S.dur=Action 2
    ,S.start=[To Enemy do
        enemy <- target slot
        targeting Self $ apply 2 skillName [Block enemy]]
    ,S.effects=[To Enemy do damage 15; apply 1 skillName [Expose]]}
  ("Edo Tensei Itachi (S)",2) -> s {S.require=[Unusable]}
  ("Edo Tensei Itachi (S)",4) -> s
    {S.charges=1,S.classes=s.classes ++ [Soulbound]
    ,S.effects=[To Enemy do afflict 20; apply Permanent skillName [Afflict 5]; apply 1 skillName [Stun All]]}
  ("Edo Tensei Itachi (S)",5) -> s
    {S.charges=1,S.classes=s.classes ++ [Invisible]
    ,S.effects=[To Ally $ trap Permanent skillName (OnHealthMax 5) do
        setHealth 40
        apply 3 "Kotoamatsukami Recovery" [Heal 5]]}
  ("Edo Tensei Itachi (S)",6) -> s
    {S.charges=1,S.classes=s.classes ++ [Invisible]
    ,S.effects=[To Enemy $ trap Permanent skillName (Countered All) do
        enemy <- P.nTarget
        forM_ enemy.lastSkill $ \skill -> P.modify enemy.slot $ Cooldown.alter (4+skill.cooldown) (ID.from skill)]}
  ("Edo Tensei Fuu (S)",0) -> s
    {S.effects=[To Enemy do damage 15; apply 1 skillName [Bleed [All] Flat 10]]}
  ("Edo Tensei Fuu (S)",1) -> s
    {S.classes=s.classes ++ [Bypassing]
    ,S.effects=[To Self $ apply 1 skillName [Invulnerable All],To Enemy $ damage 30]}
  ("Edo Tensei Fuu (S)",2) -> s
    {S.dur=Control 2
    ,S.start=[To Enemy do pierce 10; control [Expose]]
    ,S.effects=[To Enemy $ unlessM (Context.new <$> P.context) do damage 10; apply 1 skillName [Stun All]]}
  ("Edo Tensei Fuu (S)",3) -> s {S.changes=fuuRepeat}
  ("Edo Tensei Yagura (S)",0) -> s
    {S.classes=s.classes ++ [Invisible,Bypassing]
    ,S.require=[TargetHas AtMost 0 "Water Mirror Mark"]
    ,S.effects=[To Enemy do
        tag 3 "Water Mirror Mark"
        trap 3 skillName OnHarm do
          previous <- target N.lastSkill
          forM_ previous rememberMirror
          apply 1 skillName [Weaken [NonBane] Flat 5]]}
  ("Edo Tensei Yagura (S)",1) -> s
    {S.changes = \n skill -> if null n.storedSkills then skill {S.require=[Unusable]}
                           else if hasMarker "Mirror Discount" n then setCost [Rand] skill else skill
    ,S.effects=[To Enemy do
        improved <- user has "Mirror Double"
        replicateM_ (if improved then 2 else 1) castMirror
      ,To Self mirrorGuard]}
  ("Edo Tensei Yagura (S)",2) -> s
    {S.effects=[To Enemy do
        damage 30
        apply 1 skillName [Weaken [NonBane] Flat 5]
        enemy <- P.nTarget
        selected <- R.choose [skill | skill <- toList enemy.skills,Harmful `elem` skill.classes,Unusable `notElem` skill.require]
        forM_ selected rememberMirror
      ,To Self do tag 1 "Mirror Double"; mirrorGuard]}
  ("Edo Tensei Yagura (S)",3) -> s
    {S.effects=[To Self do tag 1 "Mirror Discount"; apply 1 skillName [Invulnerable All]]}
  (_,3) -> s {S.effects=[To Self $ apply 1 skillName [Invulnerable All]]}
  _ -> s {S.require=[Unusable]}
 where
  augment sk
    | name=="True Art Deidara (S)" = sk {S.start=To Self deidaraUse:sk.start}
    | name=="Shinobi Alliance Kiba (S)" = sk {S.changes=sk.changes `also` changeWith "Man Animal Discount" ((\skill -> skill {S.cost=C.spend [Rand] skill.cost}))}
    | name=="Shinobi Alliance Chouji (S)" = sk {S.changes=sk.changes `also` changePer "Butterfly Debt" (\debt skill -> skill {S.cost=skill.cost ++ fromList (replicate debt Rand)})}
    | name=="Edo Tensei Roshi (S)" = sk {S.effects=sk.effects ++ [To Self $ whenM (Context.new <$> P.context) $ roshiPulse True]}
    | name=="Edo Tensei Yugito (S)" && index<3 = sk {S.effects=sk.effects ++ [To Self nibiUse]}
    | name=="White Zetsu (S)" && index/=0 = sk {S.effects=sk.effects ++ [To Self $ whenM (Context.new <$> P.context) $ removeStacks "Clone Stock" 6 >> zetsuDefense]}
    | otherwise = sk

deidaraUse :: SkillEffect
deidaraUse = do
  uses <- user amount "Deidara Uses"
  addStack "Deidara Uses"
  when (uses==4) $ apply Permanent "Final Explosion Ready" [Alternate "C4: Trap" "C0: Final Explosion"]

cableDrain :: SkillEffect
cableDrain = do
  marks <- target amount "Lightning Cable Mark"
  when (marks>0) $ leech (5*marks) heal

tactics :: SkillEffect
tactics = do
  apply 2 skillName [Strengthen [NonBane] Flat 5]
  trap 2 skillName (OnHarmed All) $ tag 1 "Man Animal Discount"

stealColor colors = do
  owner <- Context.user <$> P.context
  stolen <- Chakra.remove1 colors
  P.alterGame $ Game.addChakra owner stolen

defensePoints :: Ninja -> Int
defensePoints n = sum [d.amount | d <- n.defense,D.name d=="Sasuke Susano'o"]

nibiDamage :: P.MonadPlay m => m Int
nibiDamage = do
  stacks <- user amount "Nibi Streak"
  pure (15+10*min 3 stacks)

nibiUse :: SkillEffect
nibiUse = do
  stacks <- user amount "Nibi Streak"
  when (stacks<3) $ addStack "Nibi Streak"
  removeTrap "Nibi Inactive"
  trap 2 "Nibi Inactive" OnNoHarm $ remove "Nibi Streak"

roshiPulse :: Bool -> SkillEffect
roshiPulse used = do
  strength <- user amount "Fiery Body"
  P.with (\context -> context {Context.skill=S.addClass Bypassing context.skill,Context.new=False}) $
    targeting Enemies $ asAction $ afflict (1+strength)
  when used $ addStack "Fiery Body"

prepareAnimal :: Skill -> Text -> Int -> Skill
prepareAnimal skill animal position = skill
  {S.require=[UserHas AtMost 0 ("Animal "++animal),UserHas AtMost 0 ("Animal Rest "++tshow position)]
  ,S.effects=[To Self do tag Permanent ("Animal "++animal); addStack "Animal Count"]}

summonAnimals :: SkillEffect
summonAnimals = do
  count <- user amount "Animal Count"
  when (count>0) $ defend Permanent (5*count)
  forM_ ([("Buffalo",1),("Centipede",2),("Crab",3),("Rhino",1)] :: [(Text,Int)]) $ \(animal,position :: Int) ->
    whenM (user has ("Animal "++animal)) do
      remove ("Animal "++animal)
      tag 3 ("Animal Rest "++tshow position)
      case animal of
        "Buffalo" -> do
          apply Permanent "Rhino Rotation" [Alternate "Rampaging Buffalo" "Stampeding Rhino"]
          targeting Enemies do
            damage 10
            trap 3 "Buffalo Pressure" OnNoAction $ asAction $ damage 10
          bomb 1 "Buffalo Tick" [] [To Expire $ asAction do
            targeting Enemies $ damage 10
            bomb 1 "Buffalo Last Tick" [] [To Expire $ asAction $ targeting Enemies $ damage 10]]
        "Centipede" -> targeting Allies do
          defend Permanent 15
          onBreakFrom $ asAction $ apply 3 "Centipede Venom" [Afflict 5]
        "Crab" -> targeting Allies $ apply 1 "Giant Crab" [Invulnerable NonBane]
        _ -> do
          remove "Rhino Rotation"
          rhinoHit
          bomb 1 "Rhino Tick" [] [To Expire $ asAction do
            rhinoHit
            bomb 1 "Rhino Last Tick" [] [To Expire $ asAction rhinoHit]]
  remove "Animal Count"

rhinoHit :: SkillEffect
rhinoHit = targeting REnemy do
  damage 20
  apply 1 "Stampeding Rhino" [Stun NonMental]

zetsuGrowth :: SkillEffect
zetsuGrowth = do
  stock <- user amount "Clone Stock"
  when (stock<9) $ addStacks "Clone Stock" (min 3 (9-stock))
  zetsuDefense

zetsuDefense :: SkillEffect
zetsuDefense = do
  stock <- user amount "Clone Stock"
  remove "Clone Protection"
  when (stock>=3) $ apply Permanent "Clone Protection" ([Reduce [All] Flat 15] ++ [Invulnerable Affliction | stock>=9])
  when (stock==6) $ defend Permanent 15

hasMarker :: Text -> Ninja -> Bool
hasMarker name n = N.has (ID.ID n.slot n.slot name) n

fuuRepeat :: Ninja -> Skill -> Skill
fuuRepeat n base = case n.lastSkill of
  Just previous | previous.name /= base.name ->
    base {S.cost=fromList (replicate (length previous.cost) Rand)
         ,S.effects=previous.effects ++ [To Self $ alterCooldown previous.name 2]
         ,S.start=To Self (apply 1 "Rinnegan Bonus" [Strengthen [All] Flat 5]) : previous.start
         ,S.dur=previous.dur,S.classes=previous.classes}
  _ -> base {S.require=[Unusable]}

rememberMirror :: P.MonadPlay m => Skill -> m ()
rememberMirror skill = do
  owner <- Context.user <$> P.context
  when (Unique `notElem` skill.classes && skill.name `notElem` (["Water Mirror","Hook Staff Tilt","Mirror Image"] :: [Text])) $
    P.modify owner $ \n -> n {N.storedSkills=skill:n.storedSkills}

castMirror :: SkillEffect
castMirror = do
  n <- P.nUser
  selection <- R.choose n.storedSkills
  forM_ selection $ \skill -> do
    P.modify n.slot $ \current -> current {N.storedSkills=List.deleteBy ((==) `on` S.key) skill current.storedSkills}
    P.with (\context -> context {Context.skill=skill {S.owner=n.slot},Context.new=False}) $
      Action.runTargeted (skill.start ++ skill.effects)

mirrorGuard :: SkillEffect
mirrorGuard = unlessM (user has "Mirror Guard Cooldown") do
  tag 2 "Mirror Guard Cooldown"
  trapFrom 1 "Mirror Physical" (Counter Physical) do
    previous <- target N.lastSkill
    forM_ previous rememberMirror
    targeting Self $ removeTrap "Mirror Chakra"
  trapFrom 1 "Mirror Chakra" (Counter Chakra) do
    previous <- target N.lastSkill
    forM_ previous rememberMirror
    targeting Self $ removeTrap "Mirror Physical"

rotateSharingan :: SkillEffect
rotateSharingan = do
  n <- P.nUser
  selected <- R.choose
    [ skill.name
    | variants <- toList (Character.skills n.character)
    , skill <- toList variants
    , skill.name `elem` (["Edo Tensei Mangekyou Sharingan","Edo Tensei Kotoamatsukami","Izanami"] :: [Text])
    , HM.lookupDefault 0 (S.key skill) n.charges == 0
    ]
  remove "Sharingan Rotation"
  forM_ selected $ \name ->
    applyWith [Hidden,Unremovable] Permanent "Sharingan Rotation" [Alternate "Passive: Edo Tensei Sharingan" name]

cleanseWolf :: SkillEffect
cleanseWolf = P.toTarget $ \n -> Ninjas.modifyStatuses (mapMaybe (cleanse n)) n
 where
  cleanse n status
    | Parity.allied n.slot status.user || Unremovable `elem` status.classes = Just status
    | Physical `notElem` status.classes && Chakra `notElem` status.classes = Just status
    | otherwise = case filter Effect.helpful status.effects of
        [] -> Nothing
        effects -> Just status {Status.effects=effects}
