{-# LANGUAGE OverloadedLists #-}
module Game.Characters.ClassicMore (configure,names) where
import Game.Characters.Import
import qualified Game.Model.Skill as Skill
import qualified Class.Play as P
import qualified Game.Model.Context as Context
import qualified Game.Model.Chakras as C

names :: [Text]
names = ["Mifune (S)","Shinobi Alliance Naruto (S)","Shinobi Alliance Sakura (S)","Shinobi Alliance Hinata (S)","Shinobi Alliance Temari (S)","Edo Tensei Sakon (S)","Samehada Fusion Kisame (S)","Shinobi Alliance Shino (S)","Shinobi Alliance Sai (S)"]

configure :: Text -> Int -> Skill -> Skill
configure ninja index s = result { Skill.changes=Skill.changes result `also` vision }
 where
  result=configureBase ninja index s
  vision = if ninja == "Shinobi Alliance Hinata (S)" then changeWith "Byakugan: Enhanced Vision" (Skill.addClass Unignorable) else const id

configureBase :: Text -> Int -> Skill -> Skill
configureBase ninja index s
 | ninja == "Edo Tensei Sakon (S)" = (sakon index s)
    { Skill.start=To Self (addStack "Rashomon Uses") : Skill.start (sakon index s) }
 | index == 3 = if ninja == "Shinobi Alliance Temari (S)" then defense {Skill.changes=moonDiscount} else defense
 | otherwise = case (ninja,index) of
  ("Mifune (S)",0) -> s
    { Skill.effects=[To Enemies do pierce 5; apply 1 skillName [Weaken [NonBane] Flat 5]
                   ,To Allies $ apply 1 skillName [Strengthen [Melee] Flat 5]
                   ,To Self $ apply Permanent skillName [Alternate "Samurai Troops" "Flash"]] }
  ("Mifune (S)",1) -> s
    { Skill.effects=[To Enemy $ pierce 15
                   ,To Self $ apply 1 skillName [Invulnerable Physical]
                   ,To Self $ apply Permanent skillName [Alternate "Iaito" "Flash"]] }
  ("Mifune (S)",2) -> s
    { Skill.effects=[To Enemy do pierce 15; apply 1 skillName [Alone]
                   ,To Self $ apply Permanent skillName [Alternate "Raiton Pierce" "Flash"]] }
  ("Mifune (S)",4) -> s
    { Skill.effects=[To Enemy do pierce 30; apply 1 skillName [Stun NonMental]] }
  ("Shinobi Alliance Naruto (S)",0) -> s
    { Skill.effects=[To Enemy $ damage 30,To RXEnemy $ damage 20
                   ,To Self $ apply 1 skillName [Alternate "Rasengan Riot" "Planetary Rasengan"]] }
  ("Shinobi Alliance Naruto (S)",1) -> s
    { Skill.effects=[To Enemies do
        uses <- user amount "Rasenkyugan Uses"
        pierce (15+5*uses)
      ,To Self do
        addStack "Rasenkyugan Uses"
        apply 1 skillName [Alternate "Rasenkyugan" "Mini-Bijuudama"]] }
  ("Shinobi Alliance Naruto (S)",2) -> s
    { Skill.classes=Skill.classes s ++ [Invisible]
    , Skill.effects=[To Self do
        trapFrom 1 skillName (Counter All) $ tag Permanent "Mayhem Mark"
        apply 1 skillName [Alternate "Summoning: Mayhem" "Mini-Rasenshuriken"]] }
  ("Shinobi Alliance Naruto (S)",4) -> s
    { Skill.effects=[To Enemy do
        damage 35
        dead <- not <$> target alive
        when dead $ targeting Self $ apply 2 skillName [Strengthen [All] Flat 10,Endure]] }
  ("Shinobi Alliance Naruto (S)",5) -> s
    { Skill.effects=[To Enemy do afflict 35; apply 1 skillName [Weaken [NonBane] Flat 10,Exhaust [All]]] }
  ("Shinobi Alliance Naruto (S)",6) -> s
    { Skill.classes=Skill.classes s ++ [Uncounterable,Unreflectable]
    , Skill.effects=[To Enemy do
        bonus <- 15 `bonusIf` target has "Mayhem Mark"
        demolishAll
        pierce (15+bonus)] }
  ("Shinobi Alliance Sakura (S)",0) -> s
    { Skill.effects=[To Enemy do boosted <- user has "Hundred Seals"; damage (if boosted then 35 else 20)
                   ,To XEnemies do boosted <- user has "Hundred Seals"; damage (if boosted then 10 else 5)
                   ,To Self consumeSeal] }
  ("Shinobi Alliance Sakura (S)",1) -> s
    { Skill.effects=[To Ally do hp <- target health; heal ((100-hp) `quot` 2); cureBane
                   ,To Self consumeSeal]
    , Skill.changes=changeWith "Hundred Seals" (setCost [Rand] . setCooldown 0) }
  ("Shinobi Alliance Sakura (S)",2) -> s
    { Skill.effects=[To Self do
        boosted <- user has "Hundred Seals"
        if boosted then do heal 25; cureAll; consumeSeal
        else addStacks "Hundred Seals" 3]
    , Skill.changes=changeWith "Hundred Seals" (setCost []) }
  ("Shinobi Alliance Hinata (S)",0) -> s
    { Skill.effects=[To Enemy do
        improved <- user has "Byakugan: Enhanced Vision"
        pierce 25
        apply 1 skillName [Stun (if improved then NonMental else Chakra)]] }
  ("Shinobi Alliance Hinata (S)",1) -> s
    { Skill.effects=[To Enemy do
        improved <- user has "Byakugan: Enhanced Vision"
        pierce (if improved then 35 else 30)
        if improved then deplete 1 else deplete1 [Tai,Nin]
      ,To Self $ apply 2 skillName [Alternate "Gentle Step Twin Lion Fists" "Chakra Lion Attack"]] }
  ("Shinobi Alliance Hinata (S)",2) -> s
    { Skill.classes=Skill.classes s ++ [Unignorable]
    , Skill.effects=[To Self $ tag 4 "Byakugan: Enhanced Vision"
                   ,To Enemies $ apply 4 "Byakugan: Enhanced Vision" [Reveal]] }
  ("Shinobi Alliance Hinata (S)",4) -> s
    { Skill.effects=[To Enemy do
        improved <- user has "Byakugan: Enhanced Vision"
        pierce 25
        if improved then deplete 1 else deplete1 [Tai,Nin]] }
  ("Shinobi Alliance Temari (S)",0) -> s
    { Skill.effects=[To Self do
        tag 4 "Third Moon Unleash"
        trapFrom 4 skillName (OnHarmed All) $ addStack "Third Moon Mark"]
    , Skill.changes=moonDiscount }
  ("Shinobi Alliance Temari (S)",1) -> s
    { Skill.dur=Action 2
    , Skill.start=[To Enemy $ apply 1 skillName [Stun NonMental]
                 ,To Self $ apply 1 skillName [Invulnerable NonMental]]
    , Skill.effects=[To Enemy do
        extra <- (*5) <$> target amount "Third Moon Mark"
        fresh <- Context.new <$> P.context
        if fresh then pierce (15+extra) else damage (15+extra)]
    , Skill.changes=moonDiscount }
  ("Shinobi Alliance Temari (S)",2) -> s
    { Skill.effects=[To Enemy do
        extra <- (*5) <$> target amount "Third Moon Mark"
        pierce (40+extra)
        trap Permanent skillName OnDeath $ targeting Self $ gain [Rand]]
    , Skill.changes=moonDiscount }
  ("Samehada Fusion Kisame (S)",0) -> s
    { Skill.classes=Skill.classes s ++ [Soulbound]
    , Skill.effects=[To XAllies $ sharkDance
                   ,To Enemies $ sharkDance
                   ,To Self $ tag 3 "Shark Dance Discount"] }
  ("Samehada Fusion Kisame (S)",1) -> s
    { Skill.dur=Action 2
    , Skill.effects=[To Enemy do pierce 20; deplete 1]
    , Skill.changes=changeWith "Shark Dance Discount" (\sk -> sk {Skill.cost=C.spend [Rand] sk.cost}) }
  ("Samehada Fusion Kisame (S)",2) -> s
    { Skill.classes=Skill.classes s ++ [Uncounterable]
    , Skill.effects=[To Enemies $ damage 25,To REnemy $ deplete 1,To Self $ defend Permanent 15]
    , Skill.changes=changeWith "Shark Dance Discount" (\sk -> sk {Skill.cost=C.spend [Rand] sk.cost}) }
  ("Shinobi Alliance Shino (S)",0) -> s
    { Skill.effects=[To Enemy $ apply 3 skillName [Afflict 10]]
    , Skill.changes=changeWith "Bug Barrier Active" (\sk -> sk
        {Skill.effects=[To Enemy $ apply 3 skillName [Afflict 10]
                       ,To Ally $ apply 3 skillName [Heal 10]]}) }
  ("Shinobi Alliance Shino (S)",1) -> s
    { Skill.effects=[To Enemy do
        apply 3 skillName [Afflict 15,Expose]
        trapFrom 3 skillName (OnDamaged All) $ heal 15] }
  ("Shinobi Alliance Shino (S)",2) -> s
    { Skill.classes=Skill.classes s ++ [Soulbound,Nonstacking]
    , Skill.effects=[To Allies do
        heal 15
        defend 1 15
        remove "Bug Barrier Regeneration"
        bomb 1 "Bug Barrier Warmup" []
          [To Expire $ asAction $ apply Permanent "Bug Barrier Regeneration" [Heal 5]]
      ,To Self $ tag Permanent "Bug Barrier Active"] }
  ("Shinobi Alliance Sai (S)",0) -> s
    { Skill.dur=Action Permanent
    , Skill.classes=Skill.classes s ++ [Soulbound]
    , Skill.start=[To Enemy $ trap Permanent skillName (OnAction All) do
        cancelChannel "Tiger Vision Staring Bullet"
        remove "Tiger Vision Staring Bullet"
        targeting Self $ gain [Gen]]
    , Skill.effects=[To Enemy do damage 25; apply 1 skillName [Stun Harmful]]
    , Skill.changes=changeWith "Tiger Discount" (setCost [Rand]) }
  ("Shinobi Alliance Sai (S)",1) -> s
    { Skill.dur=Action Permanent
    , Skill.classes=Skill.classes s ++ [Soulbound]
    , Skill.start=[To Enemy $ trap Permanent skillName (OnAction All) $ asAction do
        pierce 20
        cancelChannel "Great Beast Painting: Kamikaze Birds"
        remove "Great Beast Painting: Kamikaze Birds"]
    , Skill.effects=[To Enemy do
        apply 1 skillName [Bleed [NonBane] Flat 5]
        pierce 10]
    , Skill.changes=changeWith "Birds Discount" (setCost []) }
  ("Shinobi Alliance Sai (S)",2) -> s
    { Skill.effects=[To XAlly do
        defend Permanent 20
        onBreak $ asAction $ targeting Self $ tag 1 "Birds Discount"
      ,To Self do
        defend Permanent 20
        onBreak $ asAction $ tag 1 "Tiger Discount"] }
  _ -> s { Skill.require=[Unusable] }
 where
  defense = s { Skill.effects=[To Self $ apply 1 skillName [Invulnerable All]] }

consumeSeal :: SkillEffect
consumeSeal = removeStack "Hundred Seals"

moonDiscount :: Ninja -> Skill -> Skill
moonDiscount = changeWith "Third Moon Unleash" (\sk -> sk {Skill.cost=C.spend [Rand] sk.cost})

sharkDance :: SkillEffect
sharkDance = do
  tag 3 "Shark Dance Clock"
  apply 3 "Shark Dance Cost" [Exhaust [Harmful]]
  trap 3 "Water Prison Shark Dance" OnHarm do
    remove "Shark Dance Cost"
    bomb 1 "Shark Dance Grace" [] [To Expire $ asAction do
      remaining <- fromMaybe 0 <$> target duration "Shark Dance Clock"
      when (remaining > 0) $ apply remaining "Shark Dance Cost" [Exhaust [Harmful]]]

sakon :: Int -> Skill -> Skill
sakon index s = case index of
  0 -> s { Skill.effects=[To Enemy do
             extra <- 5 `bonusIf` user has "Parasite Demon Used"
             damage (20+extra)
             pierce 15
             apply 1 skillName [Weaken [NonBane] Flat 15]
           ,To Self $ tag 1 "Enhanced Gatling Punch Used"] }
  1 -> s { Skill.require=[TargetHas AtMost 0 "Parasite Demon"]
         , Skill.effects=[To Enemy do
             improved <- user has "Enhanced Gatling Punch Used"
             afflict 20
             apply 1 "Parasite Demon" (if improved then [Stun All] else [Stun Physical,Stun Chakra])
           ,To Self $ tag 1 "Parasite Demon Used"] }
  2 -> s { Skill.effects=[To Self do
             used <- user amount "Rashomon Uses"
             cureAll
             defend Permanent (15*used)
             remove "Rashomon Uses"]
         , Skill.changes=changePer "Rashomon Uses" (\used sk -> sk {Skill.cooldown=2+used}) }
  3 -> s { Skill.effects=[To Self $ apply 1 skillName [Invulnerable All]] }
  _ -> s { Skill.require=[Unusable] }
