{-# LANGUAGE OverloadedLists #-}
module Game.Characters.ClassicRules (configure) where
import Game.Characters.Import
import qualified Game.Model.Skill as Skill
import qualified Game.Model.Ninja as N
import qualified Class.Play as P
import qualified Game.Model.Context as Context
import qualified Game.Characters.ClassicMore as More
import qualified Game.Characters.ClassicNext as Next

import qualified Game.Characters.ClassicFinal as Final

configure :: Text -> Int -> Skill -> Skill
configure ninja index s
 | ninja `elem` Final.names = Final.configure ninja index s
 | ninja `elem` Next.names = Next.configure ninja index s
 | ninja `elem` More.names = More.configure ninja index s
 | index == 3 && ninja /= "ET Susanoo Itachi (S)" = s { Skill.effects=[To Self $ apply 1 skillName [Invulnerable All]] }
 | otherwise = case (ninja,index) of
  ("Shiore Orochimaru",0) -> s
    { Skill.effects=[To Enemy $ apply 3 skillName [Afflict 10,Weaken [NonBane] Flat 10,Exhaust [Harmful]] ] }
  ("Shiore Orochimaru",1) -> s
    { Skill.dur=Action 2, Skill.start=[To Enemy $ apply 1 skillName [Stun All]]
    , Skill.effects=[To Enemy $ damage 20] }
  ("Shiore Orochimaru",2) -> s
    { Skill.dur=Action 3
    , Skill.start=[To Enemy do
        apply 3 skillName [Disable (Any Invulnerable)]
        trap 3 skillName OnDeath $ asAction $ targeting Self $ gain [Rand]]
    , Skill.effects=[To Enemy $ leech 5 heal] }
  ("Shizune (S)",0) -> s
    { Skill.effects=[To Allies do
        extra <- 5 `bonusIf` user has "Chakra Reinforcement"
        heal (15+extra)] }
  ("Shizune (S)",1) -> s
    { Skill.classes=Skill.classes s ++ [Invisible]
    , Skill.effects=[To Ally $ trap 1 skillName (Counter All) doNothing] }
  ("Shizune (S)",2) -> s
    { Skill.effects=[To Self $ apply 3 skillName [Reduce [All] Flat 10,Alternate "Chakra Reinforcement" "Four-Corner Sealing Barrier"]] }
  ("Shizune (S)",4) -> s
    { Skill.effects=[To Enemy $ damage 25,To Self $ apply 1 skillName [Invulnerable All]] }
  ("Hebi Sasuke (S)",0) -> s
    { Skill.effects=[To Enemy $ pierce 20,To Self $ apply 3 skillName [Strengthen [All] Flat 10]] }
  ("Hebi Sasuke (S)",1) -> s
    { Skill.classes=Skill.classes s ++ [Invisible]
    , Skill.effects=[To Self $ trapFrom 1 skillName (Counter All) do
        pierce 10
        targeting Self $ defend Permanent 10] }
  ("Hebi Sasuke (S)",2) -> s
    { Skill.classes=Skill.classes s ++ [Uncounterable]
    , Skill.effects=[To Enemy do pierce 35; executeAt 15] }
  ("Young Kushina",0) -> s
    { Skill.effects=[To XAlly do
        ally <- target slot
        targeting Self do
          apply 3 skillName [Focus]
          trap 3 skillName OnHarm $ P.withTarget ally $ heal 15] }
  ("Young Kushina",1) -> s
    { Skill.effects=[To Enemy do
        enhanced <- user has "Dropping Kick"
        damage (if enhanced then 30 else 20)
        when enhanced $ apply 1 skillName [Stun All]
      ,To Self $ tag 1 "Fierce Punch"] }
  ("Young Kushina",2) -> s
    { Skill.effects=[To Enemy do
        extra <- 20 `bonusIf` user has "Fierce Punch"
        damage (10+extra)
        apply 1 skillName [Stun All]
      ,To Self $ tag 1 "Dropping Kick"] }
  ("Young Yahiko (S)",0) -> s
    { Skill.effects=[To Enemy $ pierce 35,To XEnemies $ damage 25]
    , Skill.changes=changeWith "Wave Discount" (setCost [Rand,Rand]) }
  ("Young Yahiko (S)",1) -> s
    { Skill.effects=[To Enemy do damage 20; apply 1 skillName [Stun All]
                   ,To Self $ tag 1 "Wave Discount"] }
  ("Young Yahiko (S)",2) -> s
    { Skill.effects=[To Enemy do pierce 20; deplete1 [Tai,Blood]
                   ,To Self $ tag 1 "Wave Discount"] }
  ("Young Nagato (S)",0) -> s
    { Skill.changes=changePer "Rinnegan Uses" $ \uses sk -> sk
        { Skill.cooldown=1+uses
        , Skill.effects=[To Self do
            defend Permanent 20
            tag (fromIntegral $ 1+uses) "Rinnegan Dominion"
            addStack "Rinnegan Uses"] } }
  ("Young Nagato (S)",1) -> s
    { Skill.effects=[To Enemy do
        extra <- 25 `bonusIf` user has "Rinnegan Dominion"
        damage (25+extra)
        apply 1 skillName [Stun All]] }
  ("Young Nagato (S)",2) -> s
    { Skill.effects=[To Ally do
        bomb 1 skillName [Invulnerable All]
          [To Expire $ asAction do heal 10; cureAll]]
    , Skill.changes=changeWith "Rinnegan Dominion" (setCost [Rand]) }
  ("Young Konan (S)",0) -> s
    { Skill.effects=[To Enemy do damage 20; apply 1 skillName [Seal]] }
  ("Young Konan (S)",1) -> s
    { Skill.effects=[To Enemy do damage 40; apply 1 skillName [Stun All]]
    , Skill.changes=changeWith "Paper Origami" (setCost [Gen,Rand]) }
  ("Young Konan (S)",2) -> s
    { Skill.dur=Action 3
    , Skill.start=[To Self $ apply 3 "Paper Origami" [Reduce [All] Flat 5,Enrage]]
    , Skill.effects=[To Enemy $ damage 10] }
  ("Raikage (S)",0) -> s
    { Skill.changes=changePer "Lightning Levels" $ \uses sk -> sk
        { Skill.cost=fromList $ replicate uses Rand
        , Skill.effects=[To Self do
            addStack "Lightning Levels"
            remove "Lightning Release"
            apply Permanent "Lightning Release" [Strengthen [All] Flat (10+10*uses),Reduce [All] Flat (10+5*uses)]
            trap Permanent "Lightning Release" OnHarm $ remove "Lightning Release"] } }
  ("Raikage (S)",1) -> s
    { Skill.effects=[To Enemy do
        damage 30
        bomb 1 skillName [Weaken [NonBane] Flat 15]
          [To Expire $ asAction $ apply 1 skillName [Stun All]]] }
  ("Raikage (S)",2) -> s
    { Skill.effects=[To Enemy do demolishAll; pierce 20] }
  ("Shinobi Alliance Lee (S)",0) -> s
    { Skill.effects=[To Enemy do
        dead <- numDeadAllies
        damage (15+10*dead)
        apply (fromIntegral $ 2+dead) skillName [Weaken [NonBane] Flat 15]] }
  ("Shinobi Alliance Lee (S)",1) -> s
    { Skill.effects=[To Enemy do
        dead <- numDeadAllies
        extra <- 10 `bonusIf` user has "Konoha Great Whirlwind"
        damage (25+10*dead+extra)
      , To Self do
        extra <- 10 `bonusIf` user has "Konoha Great Whirlwind"
        remove "Konoha Great Whirlwind"
        apply 1 "Konoha Great Whirlwind" [Reduce [All] Flat (10+extra)]] }
  ("Shinobi Alliance Lee (S)",2) -> s
    { Skill.effects=[To Enemy do
        dead <- numDeadAllies
        hp <- user health
        damage (20+20*dead+20*((100-hp) `quot` 30))] }
  ("Edo Tensei Kidoumaru (S)",0) -> s
    { Skill.classes=Skill.classes s ++ [Bypassing]
    , Skill.effects=[To Enemies $ trap Permanent skillName OnHarm $ addStack "Web Stack"
                   ,To Self $ apply Permanent skillName [Alternate "The Spider's Web" "Sticky Golden Arrow"]] }
  ("Edo Tensei Kidoumaru (S)",1) -> s
    { Skill.require=[UserHas AtLeast 1 "The Spider's Web"]
    , Skill.effects=[To Enemy do pierce 20; apply 1 skillName [Stun NonMental]
                   ,To Enemies do webs <- target amount "Web Stack"; pierce (5*webs)] }
  ("Edo Tensei Kidoumaru (S)",2) -> s
    { Skill.require=[UserHas AtLeast 1 "The Spider's Web"]
    , Skill.classes=Skill.classes s ++ [Uncounterable]
    , Skill.effects=[To Enemies do addStack "Web Stack"; apply 1 skillName [Weaken [NonBane] Flat 10]] }
  ("Edo Tensei Kidoumaru (S)",4) -> s
    { Skill.effects=[To Enemy do
        webs <- target amount "Web Stack"
        demolishAll
        pierce (25+10*webs)
        remove "Web Stack"] }
  ("Cursed Seal Mizuki",0) -> s
    { Skill.effects=[To Self do
        defend 3 35
        apply 3 "Curse Seal: Tiger" [Alternate "Puppets Genjutsu" "Curse Seal: Tiger Bomb"]] }
  ("Cursed Seal Mizuki",1) -> s
    { Skill.classes=Skill.classes s ++ [Nonstacking]
    , Skill.effects=[To Enemy do
        extra <- 15 `bonusIf` user has "Curse Seal: Tiger"
        damage (30+extra)
        apply 2 skillName [Weaken [NonBane] Flat 15]] }
  ("Cursed Seal Mizuki",2) -> s
    { Skill.effects=[To Enemy do
        apply 2 skillName [Expose,Weaken [All] Flat 5,Exhaust [All]]
        trap 2 skillName OnNoAction $ asAction $ damage 10] }
  ("Cursed Seal Mizuki",4) -> s
    { Skill.effects=[To Enemy $ damage 45,To Self $ apply 1 skillName [Invulnerable All]] }
  ("Edo Tensei Yota (S)",0) -> s
    { Skill.effects=[To REnemy $ damage 15,To Self do
        stacks <- user amount "Rain Stack"
        replicateM_ stacks $ targeting REnemy $ damage 15
        addStack "Rain Stack"] }
  ("Edo Tensei Yota (S)",1) -> s
    { Skill.dur=Action 2
    , Skill.start=[To Self $ apply 2 skillName [Reduce [All] Flat 15]]
    , Skill.effects=[To Enemies $ damage 10,To Self $ addStack "Rain Stack"]
    , Skill.stunned=[To Self do addStacks "Rain Stack" 2; heal 10] }
  ("Edo Tensei Yota (S)",2) -> s
    { Skill.effects=[To Enemies do stacks <- user amount "Rain Stack"; afflict (10*stacks)] }
  ("Itachi Body Double (S)",0) -> s
    { Skill.classes=Skill.classes s ++ [Invisible]
    , Skill.effects=[To Enemy $ trap 1 skillName (Countered All) $ asAction do
        damage 10
        targeting Self $ gain [Gen]] }
  ("Itachi Body Double (S)",1) -> s
    { Skill.classes=Skill.classes s ++ [Invisible]
    , Skill.dur=Ongoing 2
    , Skill.effects=[To Self $ apply 1 skillName [Reflect]] }
  ("Itachi Body Double (S)",2) -> s
    { Skill.effects=[To Enemy $ afflict 20
                   ,To Self $ bomb 1 skillName [] [To Expire $ asAction $ targeting Enemies $ afflict 10]] }
  ("Guren (S)",0) -> s
    { Skill.effects=[To Enemy do damage 35; apply 1 skillName [Stun All]; tag 1 "Crystal Dragon Hit"
                   ,To Self $ apply Permanent skillName [Alternate "Crystal Dragon" "Crystal Barrage"]] }
  ("Guren (S)",1) -> s
    { Skill.effects=[To Enemy $ apply 1 "Crystal Prison" [Alone]
                   ,To Self $ apply 1 skillName [Alternate "Crystal Prison" "Crystal Break"]] }
  ("Guren (S)",2) -> s
    { Skill.classes=Skill.classes s ++ [Invisible]
    , Skill.effects=[To Self $ trapFrom 1 skillName (Counter All) $ pierce 20] }
  ("Guren (S)",4) -> s
    { Skill.effects=[To Enemies do extra <- 10 `bonusIf` target has "Crystal Dragon Hit"; damage (25+extra)
                   ,To Self $ remove "Crystal Dragon"] }
  ("Guren (S)",5) -> s
    { Skill.require=[TargetHas AtLeast 1 "Crystal Prison"]
    , Skill.effects=[To Enemy $ pierce 30] }
  ("Susanoo Itachi (S)",0) -> s
    { Skill.require=[UserHas AtMost 0 "Susanoo Activation"]
    , Skill.dur=Ongoing Permanent
    , Skill.start=[To Self do afflict 20; tag Permanent "Susanoo Activation"]
    , Skill.effects=[To Self $ defend Permanent 5] }
  ("Susanoo Itachi (S)",1) -> s
    { Skill.require=[UserHas AtLeast 1 "Susanoo Activation"]
    , Skill.effects=[To Enemy do pierce 25; deplete1 [Gen,Blood]] }
  ("Susanoo Itachi (S)",2) -> s
    { Skill.require=[UserHas AtLeast 1 "Susanoo Activation"]
    , Skill.classes=Skill.classes s ++ [Invisible]
    , Skill.effects=[To Self do
        apply 1 skillName [Nullify,Enrage]
        trapFrom 1 skillName (OnHarmed All) $ apply 1 skillName [Exhaust [All]]] }
  ("ET Susanoo Itachi (S)",0) -> s
    { Skill.effects=[To Enemy do
        evolved <- user has "Edo Tensei Susanoo Evolved"
        if evolved then leech 20 heal else pierce 20
        apply Permanent skillName [Bleed [All] Flat 5]] }
  ("ET Susanoo Itachi (S)",1) -> s
    { Skill.effects=[To Enemy do
        evolved <- user has "Edo Tensei Susanoo Evolved"
        if evolved then leech 15 heal else pierce 15
        apply Permanent skillName [Weaken [NonBane] Flat 5]] }
  ("ET Susanoo Itachi (S)",2) -> s
    { Skill.classes=Skill.classes s ++ [Uncounterable,Unreflectable]
    , Skill.effects=[To Enemy do
        evolved <- user has "Edo Tensei Susanoo Evolved"
        if evolved then leech 35 heal else afflict 35
        deplete1 [Blood,Gen]
        apply 1 skillName [Stun Harmful]] }
  ("ET Susanoo Itachi (S)",3) -> s
    { Skill.classes=Skill.classes s ++ [Invisible]
    , Skill.effects=[To Self do
        hp <- user health
        if hp <= 35 then evolveETSusanoo
        else trap 3 skillName (OnHealthMax 35) evolveETSusanoo] }
  ("ET Susanoo Itachi (S)",4) -> s
    { Skill.classes=Skill.classes s ++ [Uncounterable]
    , Skill.effects=[To Enemies do
        evolved <- user has "Edo Tensei Susanoo Evolved"
        if evolved then leech 40 heal else pierce 40] }
  _ -> s { Skill.require=[Unusable] }

evolveETSusanoo :: SkillEffect
evolveETSusanoo = apply 3 "Edo Tensei Susanoo Evolved" [Alternate "Edo Tensei Susanoo" "Yasaka Magatama"]
