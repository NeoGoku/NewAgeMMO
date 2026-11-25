import { ITEMS } from './items';
export interface FurnDef { id: string; name: string; w: number; h: number; kind: 'deco'|'chest'|'bench'|'garden'|'petbed'|'bed'|'light'|'table'|'plant'; price: number; color: string; shape: string }
const F = (id: string, name: string, w: number, h: number, kind: FurnDef['kind'], price: number, color: string, shape = 'box'): FurnDef => ({ id: 'furn_' + id, name, w, h, kind, price, color, shape });
export const FURNITURE: FurnDef[] = [
  F('bed','Bett',3,2,'bed',200,'#6a7fd0','bed'), F('bed2','Doppelbett',4,2,'bed',500,'#a35cd0','bed'), F('sofa','Sofa',3,1,'deco',300,'#c0605a','sofa'), F('table','Esstisch',3,2,'table',250,'#a67c52','table'),
  F('chair','Stuhl',1,1,'deco',60,'#8a6a45','chair'), F('shelf','Bücherregal',2,1,'deco',280,'#7a5a3a','shelf'), F('lamp','Stehlampe',1,1,'light',120,'#ffe9a0','lamp'), F('neon','Neon-Schild',2,1,'light',400,'#ff4dd8','neon'),
  F('chest','Lagertruhe',2,1,'chest',800,'#b88a3a','chest'), F('chest2','Großer Tresor',2,2,'chest',4000,'#8a96a8','safe'), F('anvil','Werkbank',3,1,'bench',1500,'#707880','bench'), F('alch','Alchemietisch',2,1,'bench',1800,'#4aa88a','alch'),
  F('garden','Kräuterbeet',3,2,'garden',900,'#4a8f3a','garden'), F('petbed','Tierbett',2,1,'petbed',350,'#d08a5a','petbed'), F('plant','Zimmerpflanze',1,1,'plant',90,'#3fae5a','plant'), F('tree','Zierbaum',2,2,'plant',600,'#2f8f4a','tree'),
  F('rug','Teppich',4,3,'deco',220,'#8a4a6a','rug'), F('tv','Holo-Display',2,1,'deco',900,'#5ad0ff','tv'), F('fish','Aquarium',3,1,'deco',1200,'#3aa0d8','aquarium'), F('statue','Magierstatue',1,2,'deco',2500,'#b8b8c8','statue'),
  F('piano','Klavier',3,2,'deco',3000,'#2a2a30','piano'), F('fire','Kamin',3,1,'light',1100,'#d8602a','fire'), F('desk','Schreibtisch',3,1,'table',320,'#9a7a52','desk'), F('crystal','Mana-Kristall',1,1,'light',1700,'#b05cff','crystal'),
];
export const ROOM_STYLES = [
  { id: 'modern', name: 'Modern', wall: '#d8dde6', floor: '#8a9098', price: 0 }, { id: 'rustic', name: 'Rustikal', wall: '#b88a5a', floor: '#6a4a2a', price: 600 },
  { id: 'neon', name: 'Neon-Loft', wall: '#2a2040', floor: '#151025', price: 1500 }, { id: 'arcane', name: 'Arkan', wall: '#3a3a78', floor: '#22224a', price: 2500 },
  { id: 'garden', name: 'Gartenzimmer', wall: '#a8d890', floor: '#6a8a4a', price: 1000 }, { id: 'industrial', name: 'Industrial', wall: '#6a6f78', floor: '#3a3c40', price: 1200 },
];
for (const f of FURNITURE) ITEMS[f.id] = { id: f.id, name: f.name, type: 'furniture', tier: 0, lvl: 1, price: f.price, stack: 20, desc: `Möbel (${f.w}x${f.h}).`, icon: { shape: 'furn_' + f.shape, color: f.color }, tradable: true, furn: { w: f.w, h: f.h, kind: f.kind } };
export const FURN: Record<string, FurnDef> = Object.fromEntries(FURNITURE.map(f => [f.id, f]));
