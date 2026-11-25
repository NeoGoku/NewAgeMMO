/** Geografische Verankerung der Spielorte auf der realen Erde: [lat, lon, Radius in m]. Entdeckt wird ein Ort, sobald man in seinen Radius kommt. */
export const GEO_ANCHORS: Record<string, [number, number, number]> = {
  aurelia_plaza: [52.5219, 13.4132, 600], aurelia_market: [52.5236, 13.4015, 400], kessel: [52.4850, 13.4520, 500], lindenhain: [52.5163, 13.3777, 450], gildenviertel: [52.5100, 13.3900, 350],
  arena: [41.8902, 12.4922, 400], stadtpark: [52.5145, 13.3501, 900], glimmerwald: [52.4760, 13.2400, 1500], eisenzahn: [51.7990, 10.6150, 2500], schrottfeld: [52.5000, 13.4900, 700],
  port_nocturne: [53.5440, 9.9690, 1200], valdris: [41.8925, 12.4853, 800], daemonenkluft: [40.8210, 14.4260, 1200], neonkrater: [48.8800, 10.5600, 4000], kristallspitze: [47.3769, 8.5417, 900],
  schattenmoor: [53.2500, 8.9500, 3000], himmelsturm: [47.4210, 10.9850, 800], voidherz: [27.9881, 86.9250, 3000],
};
export const GEO_START: [number, number] = [52.5200, 13.4050];
