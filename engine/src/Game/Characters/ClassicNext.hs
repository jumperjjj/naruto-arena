{-# LANGUAGE OverloadedLists #-}
module Game.Characters.ClassicNext (configure,names) where
import Game.Characters.Import
import qualified Game.Model.Skill as Skill
import qualified Game.Model.Ninja as N
import qualified Game.Engine.Cooldown as Cooldown
import qualified Game.Model.ID as ID
import qualified Game.Model.Chakras as C
import qualified Class.Play as P
import qualified Data.HashMap.Strict as HM

names :: [Text]
names=["Fuuton Naruto (S)","Kisame Body Double (S)","Karatachi Yagura","Shinobi Alliance Kankuro (S)","Sasori of the Red Sand (S)"]

configure :: Text -> Int -> Skill -> Skill
configure ninja i s
 | i==3 = s {Skill.effects=[To Self $ apply 1 skillName [Invulnerable All]]}
 | otherwise = case (ninja,i) of
  ("Fuuton Naruto (S)",0) -> s
    { Skill.effects=[To Enemy $ pierce 25,To Self $ wind 1] }
  ("Fuuton Naruto (S)",1) -> s
    { Skill.effects=[To Enemy $ pierce 40,To Self $ wind 2] }
  ("Fuuton Naruto (S)",2) -> s
    { Skill.require=[UserHas AtMost 0 "Wind Clones"]
    , Skill.effects=[To Self do
        remove "Wind Clones"
        addStacks "Wind Clones" 5
        windDefense
        removeTrap "Clone Impact"
        trap Permanent "Clone Impact" (OnAttacked NonAffliction) do
          removeStack "Wind Clones"
          windDefense] }
  ("Kisame Body Double (S)",0) -> s
    { Skill.dur=Action 2
    , Skill.effects=[To Enemy do damage 25; apply 1 skillName [Weaken [NonBane] Flat 10]]
    , Skill.changes=changeWith "Explosive Water Shock Wave" (\sk->sk {Skill.cost=C.spend [Rand] sk.cost}) }
  ("Kisame Body Double (S)",1) -> s
    { Skill.effects=[To Enemy do afflict 15; apply 1 skillName [Stun NonMental,Alone]]
    , Skill.changes=changeWith "Explosive Water Shock Wave" (setCost [Rand]) }
  ("Kisame Body Double (S)",2) -> s
    { Skill.effects=[To Allies $ apply 4 "Explosive Water Shock Wave" [ChakraGuard 1]
                   ,To Enemies $ trap 4 "Explosive Water Shock Wave" (OnAction All) do
                       n<-P.nTarget
                       forM_ n.lastSkill $ \sk->do
                         let current=fromMaybe 0 $ HM.lookup (Skill.key sk) n.cooldowns
                         P.modify n.slot $ Cooldown.alter (if current==0 then 2 else 1) (ID.from sk)] }
  ("Karatachi Yagura",0) -> s
    { Skill.effects=[To Self do
        stacks<-user amount "Bloodshed Healing"
        heal (5+5*stacks)
      ,To Enemy do
        stacks<-user amount "Bloodshed Healing"
        damage (20+10*((5*stacks) `quot` 15))] }
  ("Karatachi Yagura",1) -> s
    { Skill.classes=Skill.classes s ++ [Uncounterable]
    , Skill.effects=[To Enemies do
        pierce 10
        trap 2 skillName OnNoAction $ apply 1 skillName [Snare 1]
        trap 2 skillName (OnAction All) $ targeting Self $ addStack "Bloodshed Healing"]
    , Skill.changes=changeWith "Isobu Random Cost" (setCost [Rand]) }
  ("Karatachi Yagura",2) -> s
    { Skill.classes=Skill.classes s ++ [Unremovable]
    , Skill.effects=[To Self do
        apply 1 skillName [Focus]
        tag 1 "Isobu Random Cost"
        awakened<-user has "Isobu Awakened"
        unless awakened do
          tag Permanent "Isobu Awakened"
          trap Permanent "Isobu Awakening" (OnAction All) $ apply 1 skillName [Focus]] }
  ("Shinobi Alliance Kankuro (S)",0) -> s
    { Skill.effects=[To Self do
        remove "Mastery Points"
        addStacks "Mastery Points" 5
        masteryDefense
        removeTrap "Mastery Impact"
        trap Permanent "Mastery Impact" (OnAttacked NonAffliction) do
          removeStack "Mastery Points"
          masteryDefense] }
  ("Shinobi Alliance Kankuro (S)",1) -> s
    { Skill.effects=[To Enemies do points<-user amount "Mastery Points"; damage (5*points)]
    , Skill.changes=changePer "Mastery Points" $ \points sk->if points<=3 then sk {Skill.cost=C.spend [Rand] sk.cost} else sk }
  ("Shinobi Alliance Kankuro (S)",2) -> s
    { Skill.effects=[To Ally do points<-user amount "Mastery Points"; defend Permanent (10*points)]
    , Skill.changes=changePer "Mastery Points" $ \points sk->if points<=3 then sk {Skill.cost=C.spend [Rand] sk.cost} else sk }
  ("Sasori of the Red Sand (S)",0) -> s
    { Skill.effects=[To Enemy do
        damage 10
        tag 1 "Thousand Hands Exposure"
        bomb 1 "Thousand Hands Followup" [] [To Expire $ asAction do
          damage 10
          targeting Self $ defend Permanent 5]
      ,To Self $ defend Permanent 5] }
  ("Sasori of the Red Sand (S)",1) -> s
    { Skill.classes=Skill.classes s ++ [Uncounterable,Soulbound]
    , Skill.effects=[To Enemies do
        extended<-target has "Thousand Hands Exposure"
        let turns=if extended then 6 else 5
        apply turns skillName [Afflict 5]
        trap turns skillName OnHarm $ asAction $ afflict 5
      ,To Self $ defend 5 5] }
  ("Sasori of the Red Sand (S)",2) -> s
    { Skill.dur=Ongoing 3
    , Skill.start=[To Self do
        apply 3 "Iron Sand" [Alternate "Iron Sand" "Satetsu Kaiho",Alternate "Thousand Hands" "Satetsu Kesshu"]
        trapFrom 3 "Iron Sand" (OnHarmed All) $ asAction $ pierce 5]
    , Skill.effects=[To Self $ defend Permanent 10] }
  ("Sasori of the Red Sand (S)",4) -> s
    { Skill.effects=[To Enemy do pierce 30; apply 2 skillName [Expose]
                   ,To Self $ defend 1 15] }
  ("Sasori of the Red Sand (S)",5) -> s
    { Skill.classes=Skill.classes s ++ [Uncounterable,Unreflectable]
    , Skill.effects=[To Enemies do pierce 25; executeAt 10] }
  _->s {Skill.require=[Unusable]}

wind :: Int -> SkillEffect
wind repetitions=do
  clones<-user amount "Wind Clones"
  when (clones>0) do
    targeting Enemies $ bomb 1 "Wind Destruction" [Weaken [NonBane] Flat (5*repetitions)]
      [To Expire $ asAction $ pierce (10*repetitions)]
    removeStacks "Wind Clones" 2
    windDefense

windDefense :: SkillEffect
windDefense=do
  clones<-user amount "Wind Clones"
  remove "Mass Shadow Clones"
  when (clones>0) $ apply Permanent "Mass Shadow Clones" [Reduce [All,Affliction] Percent (10*clones)]

masteryDefense :: SkillEffect
masteryDefense=do
  points<-user amount "Mastery Points"
  remove "Kankuro: Puppet Mastery"
  when (points>0) $ apply Permanent "Kankuro: Puppet Mastery" [Reduce [All,Affliction] Flat (5*points)]
