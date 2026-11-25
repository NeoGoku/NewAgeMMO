export type Svc = 'shop'|'repair'|'stash'|'teleport'|'auction'|'guild'|'housing'|'pets'|'arena'|'mailbox'|'heal'|'stall'|'orders'|'trainer'|'mounts'|'stats';
export interface NpcDef { id: string; name: string; title: string; loc: string; color: string; kind: string; greeting: string; services: Svc[]; shop?: { types: string[]; tiers: number[] }; prof?: string }
export interface Hotspot { id: string; kind: 'npc'|'station'|'houses'|'stalls'|'decor'; x: number; y: number; label: string; npc?: string; prof?: string; art: string; w?: number }
export interface Link { to: string; x: number; y: number; sec: number; label: string }
export interface LocDef { id: string; name: string; kind: 'city'|'district'|'wild'|'dungeon'|'arena'|'boss'; theme: string; lvl: [number, number]; safe: boolean; pvp: boolean; desc: string; links: Link[]; hotspots: Hotspot[]; spawns: { mob: string; n: number }[]; nodes: { def: string; n: number }[]; weather: string[]; map: [number, number]; tele?: number }
export const LOCS: Record<string, LocDef> = {}; export const NPCS: Record<string, NpcDef> = {};
const L = (d: Omit<LocDef, 'hotspots'|'spawns'|'nodes'|'weather'> & Partial<Pick<LocDef, 'hotspots'|'spawns'|'nodes'|'weather'>>) => { LOCS[d.id] = { hotspots: [], spawns: [], nodes: [], weather: ['clear','clear','rain'], ...d }; };
const N = (id: string, name: string, title: string, loc: string, kind: string, color: string, greeting: string, services: Svc[], extra: Partial<NpcDef> = {}) => { NPCS[id] = { id, name, title, loc, kind, color, greeting, services, ...extra }; };
const npcHs = (id: string, x: number, y: number, art = 'person'): Hotspot => ({ id: 'hs_' + id, kind: 'npc', x, y, label: NPCS[id]?.name || id, npc: id, art });
const stHs = (prof: string, x: number, y: number, label: string, art = 'forge'): Hotspot => ({ id: `st_${prof}_${x}`, kind: 'station', x, y, label, prof, art });
// ---- NPCs ----
N('mira','Mira Falkenhain','Aurelia-Begrüßerin','aurelia_plaza','human','#ffb0c0','Willkommen in Aurelia, Reisender! Im Jahr 2030 ist Magie Alltag – und die Stadt hat Arbeit für jeden.',['heal','mailbox'],{});
N('torben','Torben Eisenfaust','Ausrüster','aurelia_plaza','human','#c0a070','Frische Ausrüstung gefällig? Die beste Stahlware nördlich des Hafens.',['shop','repair'],{ shop: { types: ['weapon','armor','accessory'], tiers: [0,1,2] } });
N('lena','Lena Quirl','Apothekerin','aurelia_plaza','human','#a0f0c0','Tränke, Elixiere, Rollen – alles, was das Leben rettet.',['shop'],{ shop: { types: ['consumable'], tiers: [0,1,2,3] } });
N('orwin','Archivar Orwin','Questverwalter','aurelia_plaza','human','#c0c0ff','Das Schwarze Brett der Stadt. Aufträge, Kunde, Ruhm – such dir etwas aus.',['stats'],{});
N('vex','Vex Transportal','Teleporter','aurelia_plaza','robot','#35e0ff','Teleportnetz online. Ziel wählen, bezahlen, verschwinden.',['teleport','mounts'],{});
N('bankier','Bankier Hollis','Lagerhalter','aurelia_plaza','human','#e0d080','Dein persönliches Lager ist sicher bei mir.',['stash','mailbox'],{});
N('gildmeister','Gildenmeisterin Sora','Gildenregister','aurelia_plaza','human','#ff9a5a','Gründe eine Gilde oder tritt einer bei – gemeinsam seid ihr stärker.',['guild'],{});
N('arena_chef','Arenameister Brakk','Colosseum','arena','human','#ff6a6a','Im Colosseum zählt nur Können. Alle Kämpfer haben gleiche Werte!',['arena','heal'],{});
N('ahmed','Händler Ahmed','Auktionator','aurelia_market','human','#ffd04d','Auktionshaus! Kaufen, verkaufen, Schnäppchen jagen.',['auction','orders'],{});
N('stallmeister','Stallmeisterin Joan','Marktaufsicht','aurelia_market','human','#d0a0ff','Eröffne deinen eigenen Verkaufsstand auf dem Markt.',['stall'],{});
N('petra','Petra Zwirn','Tierzüchterin','aurelia_market','human','#ffa0d0','Pets sind die besten Freunde! Eier ausbrüten, trainieren, züchten.',['pets','shop'],{ shop: { types: ['egg'], tiers: [0] } });
N('markt_koch','Koch Bruno','Gerichte','aurelia_market','human','#ffb060','Heiß und frisch!',['shop','heal'],{ shop: { types: ['consumable'], tiers: [0,1,2] } });
N('schmied','Schmied Garrick','Meisterschmied','kessel','human','#ff8a3d','Hitze, Funken, Stahl! Ich lehre dir das Schmieden.',['trainer','repair','shop'],{ prof: 'smithing', shop: { types: ['tool'], tiers: [0,1,2,3,4] } });
N('ingenieur','Ingenieurin Tesla Novak','Technikerin','kessel','robot','#35e0ff','Schrauben, Chips, Sprengstoff – mein Ding!',['trainer','mounts'],{ prof: 'engineering' });
N('schneider','Schneiderin Isolde','Schneiderei','kessel','human','#c46cff','Stoffe und Leder sind meine Welt.',['trainer'],{ prof: 'tailoring' });
N('alchemist','Alchemistin Verena','Alchemie','kessel','human','#4aa8ff','Es blubbert, es dampft – es wirkt!',['trainer'],{ prof: 'alchemy' });
N('koch','Küchenmeister Hajo','Küche','aurelia_market','human','#ffb02e','Gutes Essen gibt Kraft!',['trainer'],{ prof: 'cooking' });
N('baumeister','Baumeister Ole','Bauwesen','lindenhain','human','#8bd36b','Möbel, Räume, Träume.',['trainer'],{ prof: 'building' });
N('zuechter','Züchterin Hanne','Tierzucht','lindenhain','human','#ff7aa8','Ein gutes Tier braucht Liebe.',['trainer','pets'],{ prof: 'husbandry' });
N('minenmeister','Minenmeister Brokk','Bergbau','stadtpark','human','#b0b7c0','Spitzhacke raus und los!',['trainer','shop'],{ prof: 'mining', shop: { types: ['tool'], tiers: [0] } });
N('kraeuterhex','Kräuterhexe Efeu','Kräuterkunde','stadtpark','human','#5ee06a','Jedes Kraut hat seine Kraft.',['trainer'],{ prof: 'herbalism' });
N('holzfaeller','Holzfäller Ragnar','Holzfällen','stadtpark','human','#a67c52','Baumfällen will gelernt sein.',['trainer'],{ prof: 'woodcutting' });
N('makler','Maklerin Greta','Wohnungsamt','lindenhain','human','#ffd0a0','Ein Zuhause in Aurelia – hier bist du richtig. Ein Haus kostet nur ein paar Münzen.',['housing'],{});
N('gilden_makler','Hausverwalter Kurt','Gildenhäuser','lindenhain','human','#d0a070','Gildenhäuser stehen im Gildenviertel.',['guild'],{});
N('ranger','Förster Elias','Parkranger','stadtpark','human','#6fdc5a','Die Tiere sind verändert, seit die Magie öffentlich wurde.',['heal'],{});
N('wanderer','Wanderer Finn','Waldbewohner','glimmerwald','human','#8fd0ff','Der Glimmerwald leuchtet nachts – und beißt.',['heal'],{});
N('scout','Späher Jarl','Eisenzahn-Späher','eisenzahn','human','#c0c8d8','Räuber kontrollieren die Pässe.',['heal','shop'],{ shop: { types: ['consumable'], tiers: [1,2] } });
N('techniker','Techniker Rho','Schrottfeld-Techniker','schrottfeld','robot','#d08a3a','Die Maschinen laufen Amok.',['heal','shop'],{ shop: { types: ['consumable'], tiers: [1,2] } });
N('hafenmeister','Hafenmeister Dunkan','Hafenstadt','port_nocturne','human','#6aa0d0','Port Nocturne – wo Nacht und Handel sich treffen.',['heal','shop','stash','teleport'],{ shop: { types: ['weapon','armor','accessory'], tiers: [2,3,4] } });
N('syndikat_boss','Syndikat-Kontakt Raven','Schattenmarkt','port_nocturne','human','#e05050','Man erzählt sich Dinge im Hafen... für den richtigen Preis.',['shop','auction'],{ shop: { types: ['consumable'], tiers: [3,4] } });
N('rat_magier','Ratsmagierin Alessia','Magierrat','kristallspitze','human','#8f8cff','Der Rat wacht über die Magie.',['heal','shop','stash','teleport'],{ shop: { types: ['weapon','armor','accessory'], tiers: [4,5,6] } });
N('technik_union','Union-Ingenieur Hale','Technikerunion','kristallspitze','robot','#35e0ff','Technik schlägt Magie – meistens.',['shop'],{ shop: { types: ['consumable','tool'], tiers: [4,5,6] } });
N('valdris_priest','Pilger Aurel','Valdris-Rastplatz','valdris','human','#ffe9a0','Hier ruhen die Toten – und das Böse.',['heal'],{});
N('moor_hexe','Moorweise Brigga','Schattenmoor','schattenmoor','human','#8aa060','Im Moor gilt nur das Recht des Stärkeren.',['heal'],{});
N('turm_waechter','Turmwächter Elan','Himmelsturm','himmelsturm','human','#e0e8ff','Der Turm prüft jeden Kletterer.',['heal','shop'],{ shop: { types: ['consumable'], tiers: [6,7] } });
N('leere_seher','Seher Nyx','Leerenseher','voidherz','human','#b05cff','Das Herz der Leere ruft...',['heal'],{});
N('kluft_waechter','Kluftwächter Hob','Dämonenkluft','daemonenkluft','human','#c0a0a0','Kehrt um, solange ihr könnt.',['heal'],{});
N('krater_ing','Kraterforscher Dr. Okoye','Forscher','neonkrater','robot','#4ad0ff','Der Krater strahlt Energie ab.',['heal'],{});
// ---- Locations ----
L({ id: 'aurelia_plaza', name: 'Aurelia – Zentralplatz', kind: 'city', theme: 'city', lvl: [1, 100], safe: true, pvp: false, desc: 'Das pulsierende Herz der Hauptstadt – Magie und Technik Seite an Seite.', map: [50, 50], tele: 0,
  links: [{ to: 'aurelia_market', x: 8, y: 78, sec: 3, label: 'Marktviertel' }, { to: 'kessel', x: 92, y: 78, sec: 3, label: 'Kessel' }, { to: 'lindenhain', x: 50, y: 84, sec: 3, label: 'Lindenhain' }, { to: 'stadtpark', x: 30, y: 84, sec: 4, label: 'Stadtpark' }, { to: 'arena', x: 70, y: 84, sec: 3, label: 'Colosseum' }],
  hotspots: [npcHs('mira', 50, 70), npcHs('torben', 22, 62), npcHs('lena', 36, 58), npcHs('orwin', 62, 60, 'board'), npcHs('vex', 78, 62, 'portal'), npcHs('bankier', 14, 72, 'bank'), npcHs('gildmeister', 88, 62, 'guildhall'), { id: 'hs_fountain', kind: 'decor', x: 50, y: 52, label: 'Brunnen', art: 'fountain' }] });
L({ id: 'aurelia_market', name: 'Aurelia – Marktviertel', kind: 'district', theme: 'market', lvl: [1, 100], safe: true, pvp: false, desc: 'Händler, Stände und das große Auktionshaus.', map: [30, 52], tele: 0,
  links: [{ to: 'aurelia_plaza', x: 92, y: 78, sec: 3, label: 'Zentralplatz' }],
  hotspots: [npcHs('ahmed', 25, 58, 'auction'), npcHs('stallmeister', 45, 62), npcHs('petra', 62, 58, 'petshop'), npcHs('markt_koch', 80, 62, 'stand'), npcHs('koch', 14, 70, 'stand'), { id: 'hs_stalls', kind: 'stalls', x: 50, y: 78, label: 'Verkaufsstände', art: 'stalls' }] });
L({ id: 'kessel', name: 'Industrieviertel Kessel', kind: 'district', theme: 'industrial', lvl: [1, 100], safe: true, pvp: false, desc: 'Schmieden, Fabriken und Werkstätten.', map: [70, 52], tele: 0,
  links: [{ to: 'aurelia_plaza', x: 8, y: 78, sec: 3, label: 'Zentralplatz' }, { to: 'schrottfeld', x: 92, y: 78, sec: 5, label: 'Schrottfeld' }],
  hotspots: [npcHs('schmied', 20, 60), stHs('smithing', 30, 52, 'Schmiede', 'forge'), npcHs('ingenieur', 48, 60), stHs('engineering', 58, 52, 'Werkstatt', 'workshop'), npcHs('schneider', 74, 62), stHs('tailoring', 84, 54, 'Schneiderei', 'loom'), npcHs('alchemist', 40, 72), stHs('alchemy', 62, 74, 'Alchemielabor', 'cauldron')] });
L({ id: 'lindenhain', name: 'Wohnviertel Lindenhain', kind: 'district', theme: 'residential', lvl: [1, 100], safe: true, pvp: false, desc: 'Ruhige Straßen mit Häusern zum Besitzen. Das Wohnungsangebot wächst mit der Spielerzahl.', map: [50, 66], tele: 0,
  links: [{ to: 'aurelia_plaza', x: 50, y: 6, sec: 3, label: 'Zentralplatz' }, { to: 'gildenviertel', x: 92, y: 80, sec: 3, label: 'Gildenviertel' }],
  hotspots: [npcHs('makler', 20, 64), npcHs('baumeister', 40, 70), stHs('building', 52, 58, 'Tischlerei', 'workshop'), npcHs('zuechter', 70, 66), stHs('husbandry', 82, 58, 'Zuchtstall', 'stall'), stHs('cooking', 30, 80, 'Küche', 'kitchen'), { id: 'hs_houses', kind: 'houses', x: 50, y: 80, label: 'Häuser', art: 'houses' }] });
L({ id: 'gildenviertel', name: 'Gildenviertel', kind: 'district', theme: 'guild', lvl: [1, 100], safe: true, pvp: false, desc: 'Hier stehen die Gildenhäuser.', map: [68, 72], tele: 0, links: [{ to: 'lindenhain', x: 8, y: 80, sec: 3, label: 'Lindenhain' }], hotspots: [npcHs('gilden_makler', 30, 64), { id: 'hs_guildhouses', kind: 'houses', x: 62, y: 70, label: 'Gildenhäuser', art: 'guildhouses' }] });
L({ id: 'arena', name: 'Colosseum', kind: 'arena', theme: 'arena', lvl: [1, 100], safe: false, pvp: true, desc: 'Normalisierte PvP-Arena. Hier zählen Können und Taktik, nicht Ausrüstung.', map: [78, 66], links: [{ to: 'aurelia_plaza', x: 8, y: 78, sec: 3, label: 'Zentralplatz' }], hotspots: [npcHs('arena_chef', 50, 58, 'person')] });
L({ id: 'stadtpark', name: 'Stadtpark', kind: 'wild', theme: 'park', lvl: [1, 6], safe: false, pvp: false, desc: 'Grüne Oase – doch mutierte Tiere streifen umher.', map: [32, 70], tele: 0,
  links: [{ to: 'aurelia_plaza', x: 92, y: 80, sec: 4, label: 'Zentralplatz' }, { to: 'glimmerwald', x: 8, y: 66, sec: 8, label: 'Glimmerwald' }],
  hotspots: [npcHs('ranger', 78, 62), npcHs('minenmeister', 58, 60), npcHs('kraeuterhex', 34, 62), npcHs('holzfaeller', 18, 70)],
  spawns: [{ mob: 'rat', n: 5 }, { mob: 'stray', n: 4 }, { mob: 'pigeon', n: 3 }, { mob: 'boarlet', n: 3 }, { mob: 'alpha_rat', n: 1 }], nodes: [{ def: 'n_ore_0', n: 2 }, { def: 'n_herb_0', n: 3 }, { def: 'n_wood_0', n: 3 }, { def: 'n_crate_0', n: 3 }] });
L({ id: 'glimmerwald', name: 'Glimmerwald', kind: 'wild', theme: 'forest', lvl: [6, 14], safe: false, pvp: false, desc: 'Ein leuchtender Wald voller magischer Kreaturen.', map: [18, 62],
  links: [{ to: 'stadtpark', x: 92, y: 80, sec: 8, label: 'Stadtpark' }, { to: 'eisenzahn', x: 50, y: 6, sec: 10, label: 'Eisenzahn-Berge' }],
  hotspots: [npcHs('wanderer', 20, 66)], spawns: [{ mob: 'wolf', n: 5 }, { mob: 'spider', n: 4 }, { mob: 'sprite', n: 4 }, { mob: 'treant', n: 3 }, { mob: 'bear', n: 2 }, { mob: 'elder_stag', n: 1 }],
  nodes: [{ def: 'n_ore_0', n: 1 }, { def: 'n_herb_0', n: 3 }, { def: 'n_wood_0', n: 3 }, { def: 'n_herb_1', n: 2 }, { def: 'n_crate_0', n: 3 }], weather: ['clear','rain','fog','fog'] });
L({ id: 'eisenzahn', name: 'Eisenzahn-Berge', kind: 'wild', theme: 'mountain', lvl: [14, 24], safe: false, pvp: false, desc: 'Schroffe Gipfel, Räuberlager und Stürme.', map: [18, 40],
  links: [{ to: 'glimmerwald', x: 8, y: 80, sec: 10, label: 'Glimmerwald' }, { to: 'port_nocturne', x: 92, y: 80, sec: 12, label: 'Port Nocturne' }],
  hotspots: [npcHs('scout', 24, 66)], spawns: [{ mob: 'bandit', n: 5 }, { mob: 'dock_thug', n: 3 }, { mob: 'smuggler', n: 2 }, { mob: 'mtn_wolf', n: 4 }, { mob: 'harpy', n: 3 }, { mob: 'yeti', n: 3 }, { mob: 'gang_boss', n: 1 }],
  nodes: [{ def: 'n_ore_1', n: 4 }, { def: 'n_ore_2', n: 2 }, { def: 'n_herb_1', n: 2 }, { def: 'n_wood_1', n: 2 }, { def: 'n_crate_1', n: 3 }], weather: ['clear','snow','snow','storm'] });
L({ id: 'schrottfeld', name: 'Schrottfeld', kind: 'wild', theme: 'junkyard', lvl: [13, 24], safe: false, pvp: false, desc: 'Ein Friedhof ausrangierter Maschinen, die zum Leben erwachten.', map: [86, 40],
  links: [{ to: 'kessel', x: 8, y: 80, sec: 5, label: 'Kessel' }, { to: 'neonkrater', x: 92, y: 80, sec: 10, label: 'Neonkrater' }],
  hotspots: [npcHs('techniker', 22, 66)], spawns: [{ mob: 'junk_drone', n: 5 }, { mob: 'welder', n: 4 }, { mob: 'sentry', n: 3 }, { mob: 'scrap_mech', n: 1 }],
  nodes: [{ def: 'n_ore_1', n: 4 }, { def: 'n_ore_2', n: 2 }, { def: 'n_crate_1', n: 4 }], weather: ['clear','rain','fog'] });
L({ id: 'port_nocturne', name: 'Port Nocturne', kind: 'city', theme: 'harbor', lvl: [20, 100], safe: true, pvp: false, desc: 'Zweite Metropole: ein nächtlicher Hafen voller Schmuggler, Händler und Lichter.', map: [10, 22], tele: 300,
  links: [{ to: 'eisenzahn', x: 8, y: 80, sec: 12, label: 'Eisenzahn' }, { to: 'valdris', x: 92, y: 80, sec: 10, label: 'Valdris' }, { to: 'schattenmoor', x: 50, y: 84, sec: 12, label: 'Schattenmoor' }],
  hotspots: [npcHs('hafenmeister', 30, 62), npcHs('syndikat_boss', 66, 66)], weather: ['clear','fog','rain','storm'] });
L({ id: 'valdris', name: 'Ruinen von Valdris', kind: 'wild', theme: 'ruins', lvl: [22, 32], safe: false, pvp: false, desc: 'Eine versunkene Tempelstadt, in der Dämonen hausen.', map: [10, 8],
  links: [{ to: 'port_nocturne', x: 8, y: 80, sec: 10, label: 'Port Nocturne' }, { to: 'daemonenkluft', x: 92, y: 70, sec: 8, label: 'Dämonenkluft' }],
  hotspots: [npcHs('valdris_priest', 22, 66)], spawns: [{ mob: 'imp', n: 5 }, { mob: 'hellhound', n: 4 }, { mob: 'fiend', n: 4 }, { mob: 'cultist', n: 3 }, { mob: 'demon_elite', n: 1 }], nodes: [{ def: 'n_ore_2', n: 3 }, { def: 'n_herb_2', n: 3 }, { def: 'n_crate_2', n: 3 }], weather: ['clear','fog','storm'] });
L({ id: 'daemonenkluft', name: 'Dämonenkluft', kind: 'boss', theme: 'dungeon', lvl: [30, 45], safe: false, pvp: false, desc: 'Fürst Azgoroth regiert über die Dämonenkluft. Am Dungeoneingang kannst du die öffentliche Kluft oder eure Gruppeninstanz betreten.', map: [24, 4],
  links: [{ to: 'valdris', x: 8, y: 80, sec: 8, label: 'Valdris' }], hotspots: [npcHs('kluft_waechter', 14, 68)], spawns: [{ mob: 'fiend', n: 6 }, { mob: 'hellhound', n: 4 }, { mob: 'demon_elite', n: 2 }, { mob: 'azgoroth', n: 1 }], nodes: [{ def: 'n_crate_3', n: 3 }, { def: 'n_ore_3', n: 3 }], weather: ['clear'] });
L({ id: 'neonkrater', name: 'Neonkrater', kind: 'wild', theme: 'crater', lvl: [26, 38], safe: false, pvp: false, desc: 'Ein leuchtender Einschlagkrater voller Kampfroboter. Hier lauert Omega-Prime.', map: [90, 22],
  links: [{ to: 'schrottfeld', x: 8, y: 80, sec: 10, label: 'Schrottfeld' }, { to: 'kristallspitze', x: 92, y: 80, sec: 10, label: 'Kristallspitze' }], hotspots: [npcHs('krater_ing', 20, 66)],
  spawns: [{ mob: 'krater_bot', n: 5 }, { mob: 'laser', n: 4 }, { mob: 'hunter', n: 4 }, { mob: 'scrap_mech', n: 1 }, { mob: 'omega', n: 1 }], nodes: [{ def: 'n_ore_3', n: 4 }, { def: 'n_crate_3', n: 3 }], weather: ['clear','storm','fog'] });
L({ id: 'kristallspitze', name: 'Kristallspitze', kind: 'city', theme: 'crystal', lvl: [38, 100], safe: true, pvp: false, desc: 'Dritte Metropole: Akademie der Magie, schwebende Kristalltürme.', map: [90, 8], tele: 1500,
  links: [{ to: 'neonkrater', x: 8, y: 80, sec: 10, label: 'Neonkrater' }, { to: 'schattenmoor', x: 92, y: 80, sec: 12, label: 'Schattenmoor' }], hotspots: [npcHs('rat_magier', 30, 62), npcHs('technik_union', 68, 64)], weather: ['clear','clear','snow'] });
L({ id: 'schattenmoor', name: 'Schattenmoor', kind: 'wild', theme: 'moor', lvl: [42, 58], safe: false, pvp: true, desc: 'PvP-Zone! Nebel, Sumpf und die Gier der Fraktionen. Statnormalisiert.', map: [50, 18],
  links: [{ to: 'port_nocturne', x: 8, y: 80, sec: 12, label: 'Port Nocturne' }, { to: 'kristallspitze', x: 92, y: 80, sec: 12, label: 'Kristallspitze' }, { to: 'himmelsturm', x: 50, y: 6, sec: 12, label: 'Himmelsturm' }],
  hotspots: [npcHs('moor_hexe', 20, 66)], spawns: [{ mob: 'arc_golem', n: 4 }, { mob: 'moor_witch', n: 5 }, { mob: 'moor_wraith', n: 5 }, { mob: 'academy_ghost', n: 3 }, { mob: 'moor_lord', n: 1 }], nodes: [{ def: 'n_herb_4', n: 3 }, { def: 'n_ore_4', n: 3 }, { def: 'n_crate_4', n: 3 }], weather: ['fog','fog','rain','storm'] });
L({ id: 'himmelsturm', name: 'Himmelsturm', kind: 'boss', theme: 'sky', lvl: [58, 80], safe: false, pvp: false, desc: 'Ein Dungeon in den Wolken. Seraph Valkyr wartet an der Spitze.', map: [50, 4],
  links: [{ to: 'schattenmoor', x: 8, y: 80, sec: 12, label: 'Schattenmoor' }, { to: 'voidherz', x: 92, y: 40, sec: 15, label: 'Leeren-Portal' }], hotspots: [npcHs('turm_waechter', 16, 68)],
  spawns: [{ mob: 'sky_knight', n: 5 }, { mob: 'storm_elem', n: 4 }, { mob: 'angel_guard', n: 4 }, { mob: 'sky_drake', n: 2 }, { mob: 'seraph', n: 1 }], nodes: [{ def: 'n_ore_6', n: 3 }, { def: 'n_herb_6', n: 3 }, { def: 'n_crate_6', n: 3 }], weather: ['clear','storm','storm'] });
L({ id: 'voidherz', name: 'Das Void-Herz', kind: 'boss', theme: 'void', lvl: [80, 100], safe: false, pvp: false, desc: 'Endgame-Bossregion. Das Herz der Leere schlägt hier.', map: [66, 4],
  links: [{ to: 'himmelsturm', x: 8, y: 80, sec: 15, label: 'Himmelsturm' }], hotspots: [npcHs('leere_seher', 14, 68)],
  spawns: [{ mob: 'void_spawn', n: 5 }, { mob: 'void_knight', n: 4 }, { mob: 'void_titan', n: 2 }, { mob: 'voidheart', n: 1 }], nodes: [{ def: 'n_ore_8', n: 3 }, { def: 'n_herb_8', n: 3 }, { def: 'n_crate_8', n: 3 }], weather: ['storm','fog'] });
export const START_LOC = 'aurelia_plaza';
export const WEATHER: Record<string, { name: string; el: Record<string, number>; dodge?: number; crit?: number }> = {
  clear: { name: 'Klar', el: { light: 1.05 } }, rain: { name: 'Regen', el: { fire: .85, nature: 1.1 } }, storm: { name: 'Sturm', el: { arcane: 1.15, fire: .8, light: .9 } },
  fog: { name: 'Nebel', el: { shadow: 1.1 }, dodge: 5, crit: -3 }, snow: { name: 'Schnee', el: { fire: .9, ice: 1.15 } } };
export const WEATHER_DESC: Record<string, string> = { clear: 'Licht +5 %', rain: 'Feuer −15 %, Natur +10 %', storm: 'Arkan +15 %, Feuer −20 %, Licht −10 %', fog: 'Schatten +10 %, Ausweichen +5, Krit −3', snow: 'Feuer −10 %, Eis +15 %' };
