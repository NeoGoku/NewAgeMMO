export type ClassId = 'dark_mage'|'light_mage'|'archer'|'shield_sword'|'dual_sword'|'healer'|'summoner'|'tank';
export const CLASS_IDS: ClassId[] = ['dark_mage','light_mage','archer','shield_sword','dual_sword','healer','summoner','tank'];
export type Attr = 'str'|'vit'|'dex'|'int'|'wil'|'sta'|'agi'|'luk'|'mag';
export const ATTRS: Attr[] = ['str','vit','dex','int','wil','sta','agi','luk','mag'];
export const ATTR_NAMES: Record<Attr,string> = { str:'Stärke',vit:'Vitalität',dex:'Geschicklichkeit',int:'Intelligenz',wil:'Willenskraft',sta:'Ausdauer',agi:'Beweglichkeit',luk:'Glück',mag:'Magiekraft' };
export type Attrs = Record<Attr, number>;
export type Rarity = 0|1|2|3|4;
export const RARITY_NAMES = ['Normal','Ungewöhnlich','Selten','Episch','Legendär'];
export const RARITY_COLORS = ['#c9cdd4','#5ee06a','#4aa8ff','#c46cff','#ffb02e'];
export const RARITY_MULT = [1,1.15,1.35,1.65,2.1];
export type Slot = 'weapon'|'head'|'chest'|'legs'|'boots'|'gloves'|'ring'|'amulet'|'mount';
export const SLOTS: Slot[] = ['weapon','head','chest','legs','boots','gloves','ring','amulet','mount'];
export const SLOT_NAMES: Record<Slot,string> = { weapon:'Waffe',head:'Kopf',chest:'Brust',legs:'Beine',boots:'Stiefel',gloves:'Handschuhe',ring:'Ring',amulet:'Amulett',mount:'Reittier' };
export type ItemType = 'weapon'|'armor'|'accessory'|'consumable'|'material'|'tool'|'misc'|'egg'|'furniture'|'mount';
export interface Icon { shape: string; color: string }
export interface ItemDef {
  id: string; name: string; type: ItemType; slot?: Slot; cls?: ClassId; style?: 'plate'|'cloth'; tier: number; lvl: number;
  atk?: number; def?: number; mdef?: number; hp?: number; res?: number; attrs?: Partial<Attrs>;
  price: number; stack: number; desc: string; icon: Icon; tradable: boolean;
  use?: { hp?: number; res?: number; buff?: { stat: string; val: number; dur: number }; exp?: number; resetAttrs?: boolean; petFood?: number; hatch?: string; repair?: number; dmg?: number; teleport?: string; trainExp?: number; speed?: number };
  tool?: 'pickaxe'|'sickle'|'axe'; furn?: { w: number; h: number; kind?: string };
}
export interface ItemInst { uid: string; id: string; rar: Rarity; qty: number; dur?: number }
export interface Look { gender: 'm'|'f'; face: number; body: number; hair: number; hairColor: string; tattoo: number; skin: string }
export interface PetInst { uid: string; species: string; name: string; level: number; exp: number; rar: Rarity; stage: number; gen: number; energy: number; trainStart?: number; hatchAt?: number; stats: { atk: number; hp: number; spd: number } }
export interface QuestState { state: 'active'|'done'|'turned'; prog: number[]; started: number }
export interface FurniturePlacement { id: string; furn: string; x: number; y: number; rot: number; floor: number }
export interface CraftJob { id: string; recipe: string; qty: number; start: number; end: number }
export interface MailItem { id: string; from: string; subject: string; gold: number; items: ItemInst[]; t: number }
export interface Character {
  id: string; accountId: string; name: string; cls: ClassId; look: Look; level: number; exp: number; prestige: number; pexp: number;
  statPoints: number; attrs: Attrs; bonusPoints: number; trainExp: number; hp: number; res: number; gold: number; loc: string; x: number; y: number;
  inventory: ItemInst[]; stash: ItemInst[]; equipment: Partial<Record<Slot, ItemInst>>; hotbar: (string|null)[];
  quests: Record<string, QuestState>; questsDone: string[]; dailyReset: number; rep: Record<string, number>; choices: Record<string, string>;
  prof: Record<string, { lvl: number; exp: number }>; pets: PetInst[]; activePet: string|null; summons: string[];
  craftJobs: CraftJob[]; mail: MailItem[]; friends: string[]; guildId: string|null; houseId: string|null;
  kills: Record<string, number>; discovered: string[]; settings: { autoPotion: boolean; autoLoot: boolean; autoQuest: boolean }; arenaPts: number; honor: number;
  created: number; lastSeen: number; playtime: number; titles: string[];
  geo?: { consent: boolean; visible: boolean; qlat: number; qlon: number; gpsM: number; dayM: number; day: number; positionSet?: boolean; gpsFix?: { lat: number; lon: number; at: number }; gpsStrikes?: number[]; gpsLockUntil?: number };
}
export interface MobFamily { id: string; name: string }
export const FAMILIES = ['beast','demon','human','robot','magic','elite','boss'] as const;
export type Family = typeof FAMILIES[number];
