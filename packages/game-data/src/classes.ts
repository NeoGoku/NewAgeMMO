import type { ClassId, Icon } from '@nam/shared';
export type SkillKind = 'dmg'|'aoe'|'dot'|'drain'|'heal'|'aoeheal'|'hot'|'shield'|'buff'|'debuff'|'stun'|'summon'|'taunt'|'multi'|'execute';
export type Element = 'shadow'|'light'|'fire'|'ice'|'nature'|'phys'|'arcane'|'holy';
export interface SkillDef { id: string; cls: ClassId; name: string; lvl: number; cd: number; cost: number; kind: SkillKind; target: 'enemy'|'ally'|'self'|'aoe'|'party'; pow: number; el: Element; desc: string; dur?: number; n?: number; stat?: string; val?: number; stun?: number; summon?: string; icon: Icon }
export interface Passive { lvl: number; name: string; desc: string; mods: { atkPct?: number; defPct?: number; critAdd?: number; hpPct?: number; dodgeAdd?: number; speedPct?: number } }
export interface ClassDef { id: ClassId; name: string; role: string; desc: string; color: string; resource: string; skills: SkillDef[]; passives: Passive[]; summons?: Record<string, { name: string; color: string; kind: string }> }
export const ELEMENT_COLOR: Record<Element, string> = { shadow: '#9a4dff', light: '#fff2a0', fire: '#ff7a2d', ice: '#7fe0ff', nature: '#6fdc5a', phys: '#e8e8f0', arcane: '#ff5de0', holy: '#ffe9a0' };
type X = Partial<Pick<SkillDef, 'dur'|'n'|'stat'|'val'|'stun'|'summon'>>;
const mk = (cls: ClassId) => {
  const list: SkillDef[] = []; let i = 0;
  const f = (name: string, lvl: number, cd: number, cost: number, kind: SkillKind, target: SkillDef['target'], pow: number, el: Element, desc: string, x: X = {}) => {
    list.push({ id: `${cls}_${++i}`, cls, name, lvl, cd, cost, kind, target, pow, el, desc, ...x, icon: { shape: `sk_${kind}`, color: ELEMENT_COLOR[el] } }); return f; };
  return { list, f };
};
const classes: ClassDef[] = [];
const C = (id: ClassId, name: string, role: string, desc: string, color: string, resource: string, skills: SkillDef[], passives: Passive[], summons?: ClassDef['summons']) => classes.push({ id, name, role, desc, color, resource, skills, passives, summons });
{ const { list, f } = mk('dark_mage');
  f('Schattenblitz',1,1.5,8,'dmg','enemy',1.7,'shadow','Ein schneller Blitz aus Schatten.')('Seelenfeuer',4,6,14,'dot','enemy',2.4,'shadow','Verbrennt das Ziel über 8 Sek.',{dur:8})
  ('Nekrotische Welle',9,9,22,'aoe','aoe',1.5,'shadow','Welle der Nekrose trifft alle Gegner.')('Lebensentzug',14,8,20,'drain','enemy',2.0,'shadow','Schaden und heilt dich um 50 %.')
  ('Fluch der Schwäche',20,14,18,'debuff','enemy',0,'shadow','Ziel verursacht 30 % weniger Schaden.',{stat:'weak',val:.3,dur:12})('Schattenbarriere',26,20,25,'shield','self',3,'shadow','Absorbiert Schaden.',{dur:12})
  ('Verderbnis',33,12,30,'debuff','enemy',0,'shadow','Ziel erleidet 25 % mehr Schaden.',{stat:'vuln',val:.25,dur:10})('Dunkle Nova',42,16,45,'aoe','aoe',3.0,'shadow','Explosion dunkler Energie.')
  ('Seelenernte',55,18,35,'execute','enemy',2.5,'shadow','Doppelter Schaden unter 30 % Leben.')('Abgrund',70,40,70,'aoe','aoe',5.0,'shadow','Der Abgrund verschlingt alles. Betäubt 2 Sek.',{stun:2});
  C('dark_mage','Dunkler Magier','Fernkampf-Schaden','Meister von Schatten, Flüchen und Seelenmagie. Zerbrechlich, aber verheerend.','#9a4dff','Mana',list,[
    {lvl:10,name:'Schattenaffinität',desc:'+8 % Schaden',mods:{atkPct:.08}},{lvl:30,name:'Dunkle Resonanz',desc:'+5 Krit.',mods:{critAdd:5}},{lvl:50,name:'Seelenpakt',desc:'+10 % Leben',mods:{hpPct:.1}},{lvl:80,name:'Herr der Schatten',desc:'+12 % Schaden',mods:{atkPct:.12}}]); }
{ const { list, f } = mk('light_mage');
  f('Lichtstrahl',1,1.5,8,'dmg','enemy',1.6,'light','Gebündeltes Licht.')('Sonnenfunken',4,5,16,'multi','enemy',.7,'light','Drei Lichtfunken.',{n:3})
  ('Blendende Nova',9,10,24,'aoe','aoe',1.4,'light','Blendet alle Gegner 1 Sek.',{stun:1})('Heiliges Feuer',14,7,20,'dot','enemy',2.6,'holy','Brennt 8 Sek.',{dur:8})
  ('Lichtschild',20,18,25,'shield','self',2.5,'light','Schild aus Licht.',{dur:12})('Segensstrahl',26,25,22,'buff','self',0,'light','+15 Krit. für 15 Sek.',{stat:'crit',val:15,dur:15})
  ('Prisma',33,10,32,'multi','enemy',.75,'light','Fünf Prismastrahlen.',{n:5})('Sonnensturm',42,16,48,'aoe','aoe',3.0,'light','Sturm aus Sonnenlicht.')
  ('Gleißende Wahrheit',55,14,40,'dmg','enemy',4.0,'holy','Vernichtender Lichtschlag.')('Solarkollaps',70,40,75,'aoe','aoe',5.2,'light','Betäubt 1,5 Sek.',{stun:1.5});
  C('light_mage','Heller Magier','Fernkampf-Schaden','Wirkt Licht- und Sonnenmagie mit präzisen, kritischen Zaubern.','#ffe27a','Mana',list,[
    {lvl:10,name:'Lichtfokus',desc:'+5 Krit.',mods:{critAdd:5}},{lvl:30,name:'Strahlende Aura',desc:'+8 % Schaden',mods:{atkPct:.08}},{lvl:50,name:'Himmelsgunst',desc:'+10 % Leben',mods:{hpPct:.1}},{lvl:80,name:'Avatar des Lichts',desc:'+12 % Schaden',mods:{atkPct:.12}}]); }
{ const { list, f } = mk('archer');
  f('Schnellschuss',1,1.2,6,'dmg','enemy',1.5,'phys','Ein rascher Pfeil.')('Dreifachschuss',4,5,14,'multi','enemy',.75,'phys','Drei Pfeile.',{n:3})
  ('Giftpfeil',9,8,16,'dot','enemy',2.6,'nature','Gift über 8 Sek.',{dur:8})('Pfeilregen',14,10,24,'aoe','aoe',1.4,'phys','Pfeilhagel auf alle Gegner.')
  ('Frostpfeil',20,12,20,'stun','enemy',1.2,'ice','Friert Ziel 1,5 Sek. ein.',{stun:1.5})('Adlerauge',26,25,20,'buff','self',0,'phys','+20 Krit. für 15 Sek.',{stat:'crit',val:20,dur:15})
  ('Durchschlag',33,10,30,'dmg','enemy',3.2,'phys','Durchschlagender Schuss.')('Salvensturm',42,18,45,'multi','enemy',.6,'phys','Acht Pfeile.',{n:8})
  ('Todesschuss',55,18,38,'execute','enemy',2.6,'phys','Doppelt unter 30 % Leben.')('Sturm der Pfeile',70,40,70,'aoe','aoe',4.6,'phys','Pfeilsturm auf alle.');
  C('archer','Bogenschütze','Distanz-Schaden','Schnell, präzise und tödlich auf große Entfernung.','#7fdc5a','Fokus',list,[
    {lvl:10,name:'Scharfes Auge',desc:'+5 Krit.',mods:{critAdd:5}},{lvl:30,name:'Flinke Finger',desc:'+8 % Angriffstempo',mods:{speedPct:.08}},{lvl:50,name:'Jägerinstinkt',desc:'+5 Ausweichen',mods:{dodgeAdd:5}},{lvl:80,name:'Meisterschütze',desc:'+12 % Schaden',mods:{atkPct:.12}}]); }
{ const { list, f } = mk('shield_sword');
  f('Hieb',1,1.2,6,'dmg','enemy',1.5,'phys','Kräftiger Schwerthieb.')('Schildstoß',4,8,12,'stun','enemy',1.2,'phys','Betäubt 2 Sek.',{stun:2})
  ('Wirbelschlag',9,9,20,'aoe','aoe',1.3,'phys','Trifft alle Gegner.')('Bollwerk',14,20,20,'buff','self',0,'phys','+40 % Verteidigung 12 Sek.',{stat:'def',val:.4,dur:12})
  ('Klingentanz',20,8,22,'multi','enemy',.8,'phys','Drei Hiebe.',{n:3})('Provokation',26,16,15,'taunt','self',0,'phys','Gegner greifen dich 8 Sek. an.',{dur:8})
  ('Blutlinie',33,10,25,'dot','enemy',2.6,'phys','Blutung über 8 Sek.',{dur:8})('Heiliger Schwerthieb',42,12,35,'dmg','enemy',3.4,'holy','Gesegneter Hieb.')
  ('Gegenangriff',55,16,30,'execute','enemy',2.4,'phys','Doppelt unter 30 % Leben.')('Zorn des Paladins',70,40,65,'aoe','aoe',4.2,'holy','Heiliger Zorn.');
  C('shield_sword','Schildschwert','Nahkampf-Allrounder','Ausgewogener Kämpfer mit Schwert, Schild und Kontrolle.','#6fa8ff','Ausdauer',list,[
    {lvl:10,name:'Schildmeister',desc:'+8 % Verteidigung',mods:{defPct:.08}},{lvl:30,name:'Kampferfahrung',desc:'+8 % Schaden',mods:{atkPct:.08}},{lvl:50,name:'Zähigkeit',desc:'+10 % Leben',mods:{hpPct:.1}},{lvl:80,name:'Paladin',desc:'+10 % Verteidigung',mods:{defPct:.1}}]); }
{ const { list, f } = mk('dual_sword');
  f('Doppelstich',1,1.2,6,'multi','enemy',.8,'phys','Zwei schnelle Stiche.',{n:2})('Klingenwirbel',4,8,16,'aoe','aoe',1.3,'phys','Wirbel trifft alle Gegner.')
  ('Blutender Schnitt',9,8,14,'dot','enemy',2.4,'phys','Blutung 8 Sek.',{dur:8})('Schattenschritt',14,18,20,'buff','self',0,'shadow','+20 Ausweichen 8 Sek.',{stat:'dodge',val:20,dur:8})
  ('Rasende Klingen',20,9,26,'multi','enemy',.65,'phys','Fünf Hiebe.',{n:5})('Giftklingen',26,22,20,'buff','self',0,'nature','+25 % Schaden 15 Sek.',{stat:'atk',val:.25,dur:15})
  ('Meuchelstoß',33,10,30,'dmg','enemy',3.4,'phys','Tödlicher Stoß.')('Todestanz',42,16,45,'multi','enemy',.6,'phys','Acht Hiebe.',{n:8})
  ('Hinrichtung',55,16,35,'execute','enemy',2.7,'phys','Doppelt unter 30 % Leben.')('Klingensturm',70,40,70,'aoe','aoe',4.6,'phys','Klingensturm.');
  C('dual_sword','Doppelschwert','Nahkampf-Schaden','Blitzschneller Kämpfer mit zwei Klingen, Gift und Ausweichen.','#ff6a6a','Energie',list,[
    {lvl:10,name:'Flinke Klingen',desc:'+8 % Tempo',mods:{speedPct:.08}},{lvl:30,name:'Tänzer',desc:'+6 Ausweichen',mods:{dodgeAdd:6}},{lvl:50,name:'Meuchler',desc:'+6 Krit.',mods:{critAdd:6}},{lvl:80,name:'Klingenmeister',desc:'+12 % Schaden',mods:{atkPct:.12}}]); }
{ const { list, f } = mk('healer');
  f('Heilendes Licht',1,2,10,'heal','ally',1.8,'holy','Heilt Ziel oder dich.')('Strahl der Hoffnung',4,1.5,6,'dmg','enemy',1.2,'holy','Heiliger Schaden.')
  ('Regeneration',9,8,16,'hot','ally',3.0,'nature','Heilt über 10 Sek.',{dur:10})('Gruppenheilung',14,10,30,'aoeheal','party',1.2,'holy','Heilt die Gruppe.')
  ('Läuterung',20,12,18,'heal','ally',1.0,'holy','Entfernt Schwächungen und heilt.',{stat:'cleanse'})('Schutzsegen',26,16,24,'shield','ally',2.5,'holy','Schild auf Ziel.',{dur:12})
  ('Göttliche Intervention',33,25,40,'heal','ally',4.5,'holy','Mächtige Heilung.')('Segen des Schutzes',42,30,40,'buff','party',0,'holy','+30 % Verteidigung für die Gruppe.',{stat:'def',val:.3,dur:20})
  ('Heilregen',55,20,55,'aoeheal','party',2.2,'nature','Starke Gruppenheilung.')('Wunder',70,60,90,'aoeheal','party',4.5,'holy','Heilt alle massiv.');
  C('healer','Heiler','Unterstützung','Erhält die Gruppe am Leben und schützt mit göttlichem Segen.','#8ff0c0','Mana',list,[
    {lvl:10,name:'Sanfte Hände',desc:'+8 % Leben',mods:{hpPct:.08}},{lvl:30,name:'Gebet',desc:'+8 % Zauberkraft',mods:{atkPct:.08}},{lvl:50,name:'Aura der Ruhe',desc:'+8 % Verteidigung',mods:{defPct:.08}},{lvl:80,name:'Heiliger Beistand',desc:'+12 % Zauberkraft',mods:{atkPct:.12}}]); }
{ const { list, f } = mk('summoner');
  f('Seelenstoß',1,1.5,8,'dmg','enemy',1.5,'arcane','Seelenenergie als Geschoss.')('Wolfsgeist rufen',4,25,25,'summon','self',.8,'arcane','Ruft einen Wolfsgeist (30 Sek.).',{summon:'wolf',dur:30})
  ('Knochenpfeil',9,6,16,'dmg','enemy',2.0,'shadow','Knochengeschoss.')('Phönix rufen',14,35,35,'summon','self',1.0,'fire','Ruft einen Phönix (30 Sek.).',{summon:'phoenix',dur:30})
  ('Seelenband',20,25,20,'buff','self',0,'arcane','+20 % Verteidigung 15 Sek.',{stat:'def',val:.2,dur:15})('Golem rufen',26,45,45,'summon','self',.7,'nature','Ruft einen Golem, der Gegner bindet.',{summon:'golem',dur:40})
  ('Geisterhorde',33,12,35,'aoe','aoe',2.2,'arcane','Geister greifen alle an.')('Drache rufen',42,50,60,'summon','self',2.0,'fire','Ruft einen Drachen (35 Sek.).',{summon:'drake',dur:35})
  ('Seelenopfer',55,16,40,'dmg','enemy',3.8,'arcane','Opfert Seelenkraft für Schaden.')('Titan rufen',70,60,90,'summon','self',3.0,'ice','Ruft einen Titanen (45 Sek.).',{summon:'titan',dur:45});
  C('summoner','Kreaturen-Beschwörer','Beschwörer','Ruft mächtige Kreaturen, die an deiner Seite kämpfen.','#ff5de0','Seelenkraft',list,[
    {lvl:10,name:'Geisterband',desc:'+8 % Schaden',mods:{atkPct:.08}},{lvl:30,name:'Seelenstärke',desc:'+8 % Leben',mods:{hpPct:.08}},{lvl:50,name:'Meister der Bestien',desc:'+10 % Schaden',mods:{atkPct:.1}},{lvl:80,name:'Herr der Kreaturen',desc:'+12 % Schaden',mods:{atkPct:.12}}],
    { wolf: { name: 'Wolfsgeist', color: '#9fd0ff', kind: 'wolf' }, phoenix: { name: 'Phönix', color: '#ff8a3d', kind: 'phoenix' }, golem: { name: 'Steingolem', color: '#9a8a70', kind: 'golem' }, drake: { name: 'Drache', color: '#ff4d3d', kind: 'drake' }, titan: { name: 'Frosttitan', color: '#7fe0ff', kind: 'titan' } }); }
{ const { list, f } = mk('tank');
  f('Schmetterschlag',1,1.3,0,'dmg','enemy',1.4,'phys','Gewaltiger Hieb, erzeugt Wut.')('Spott',4,12,10,'taunt','self',0,'phys','Gegner greifen dich 8 Sek. an.',{dur:8})
  ('Erdbeben',9,10,20,'aoe','aoe',1.2,'phys','Erschüttert alle Gegner.')('Schutzhaltung',14,20,20,'buff','self',0,'phys','+50 % Verteidigung 12 Sek.',{stat:'def',val:.5,dur:12})
  ('Rache',20,8,25,'dmg','enemy',2.5,'phys','Schlägt zurück.')('Eiserne Haut',26,22,25,'shield','self',3,'phys','Schild aus 30 % Leben.',{dur:12})
  ('Hammerwurf',33,12,30,'stun','enemy',2.8,'phys','Betäubt 2 Sek.',{stun:2})('Lebenswille',42,30,35,'heal','self',3.5,'phys','Heilt dich.')
  ('Vernichtender Schlag',55,16,40,'execute','enemy',2.5,'phys','Doppelt unter 30 % Leben.')('Titanengebrüll',70,40,60,'aoe','aoe',3.6,'phys','Brüllen betäubt alle 2 Sek.',{stun:2});
  C('tank','Tank','Verteidiger','Unerschütterlicher Frontkämpfer, der Gegner bindet und Wut sammelt.','#c0c8d8','Wut',list,[
    {lvl:10,name:'Dicke Haut',desc:'+10 % Verteidigung',mods:{defPct:.1}},{lvl:30,name:'Standhaft',desc:'+12 % Leben',mods:{hpPct:.12}},{lvl:50,name:'Bollwerk',desc:'+10 % Verteidigung',mods:{defPct:.1}},{lvl:80,name:'Unsterblicher',desc:'+15 % Leben',mods:{hpPct:.15}}]); }
export const CLASSES: Record<ClassId, ClassDef> = Object.fromEntries(classes.map(c => [c.id, c])) as any;
export const SKILLS: Record<string, SkillDef> = Object.fromEntries(classes.flatMap(c => c.skills.map(s => [s.id, s])));
export const defaultHotbar = (cls: ClassId) => { const s = CLASSES[cls].skills; return [s[0].id, s[1].id, s[2].id, null, null, null] as (string|null)[]; };
export const SUMMON_STATS: Record<string, { hits: number; aoe?: boolean; taunt?: boolean }> = { wolf: { hits: 1 }, phoenix: { hits: 1, aoe: true }, golem: { hits: 1, taunt: true }, drake: { hits: 2 }, titan: { hits: 2, aoe: true } };
