export interface SpeciesDef { id: string; name: string; role: 'attack'|'heal'|'tank'|'buff'|'loot'|'finder'; atk: number; hp: number; spd: number; color: string; art: string; evo: [string, string, string] }
export const SPECIES: Record<string, SpeciesDef> = {};
const S = (id: string, name: string, role: SpeciesDef['role'], atk: number, hp: number, spd: number, color: string, art: string, evo: [string, string, string]) => { SPECIES[id] = { id, name, role, atk, hp, spd, color, art, evo }; };
S('rat','Ratte','finder',4,20,1.2,'#8a7a6a','rat',['Ratte','Riesenratte','Rattenkönig']); S('fox','Fuchs','loot',6,24,1.3,'#ff9a4a','fox',['Fuchs','Silberfuchs','Neunschwanz']);
S('owl','Eule','buff',5,18,1,'#c0a070','owl',['Eule','Weiseneule','Mondeule']); S('cat','Katze','attack',8,22,1.4,'#c0c0d0','cat',['Katze','Schattenkatze','Sphinx']);
S('wolfpup','Wolfsjunges','attack',10,30,1.2,'#8a96a8','wolf',['Wolfsjunges','Wolf','Fenrir']); S('boarlet','Frischling','tank',5,45,.9,'#8a5a3a','boar',['Frischling','Keiler','Urkeiler']);
S('sprite','Irrlicht','heal',4,16,1,'#7fe0ff','wisp',['Irrlicht','Waldgeist','Lichtfee']); S('golemling','Golemling','tank',6,55,.8,'#9a8a70','golem',['Golemling','Steingolem','Titan']);
S('drakelet','Drakling','attack',14,34,1.1,'#ff6a3a','drake',['Drakling','Drache','Urdrache']); S('phoenixling','Phönixküken','heal',8,28,1,'#ffb02e','phoenix',['Küken','Phönix','Sonnenphönix']);
S('slime','Schleim','buff',4,30,.9,'#6fdc9a','slime',['Schleim','Königsschleim','Arkanschleim']); S('botling','Botling','finder',7,26,1.1,'#35e0ff','bot',['Botling','Servobot','Nexus']);
export const petExp = (l: number) => Math.floor(40 * Math.pow(l, 1.7));
export const EVO_LEVELS = [0, 20, 50];
