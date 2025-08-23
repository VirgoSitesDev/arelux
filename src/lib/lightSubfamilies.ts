import type { Family, FamilyEntry, CatalogEntry } from '../app';

export interface LightSubfamily {
  code: string;
  displayName: string;
  iconItem: string; // Codice del primo item per l'icona
  models: Array<{
    baseModel: string;
    power: number;
    sampleCode: string; // Un codice esempio per questo modello
  }>;
}

export function extractSubfamilies(family: Family, catalog: Record<string, CatalogEntry>): Map<string, LightSubfamily> {
  const subfamilies = new Map<string, LightSubfamily>();
  
  // Codici sottofamiglia validi - aggiornati con i nuovi raggruppamenti
  const VALID_SUBFAMILY_CODES = ['OP', 'DEC', 'SP', 'DECR', 'SPR'];
  
  // Raggruppa per sottofamiglia
  for (const item of family.items) {
    let baseModel: string | null = null;
    let subfamilyCode: string | null = null;
    let isCurved = false;
    
    // Controlla se è una luce curva
    isCurved = item.code.includes('WWR') || item.code.includes('UWWR') || item.code.includes('NWR');
    
    // Strategia: cerca i codici sottofamiglia validi nel codice item
    for (const code of ['OP', 'GB', 'SU', 'SP']) { // Cerca ancora i codici base originali
      // Pattern 1: codice sottofamiglia con spazio prima
      let regex = new RegExp(`^([A-Z]+\\d+)(?:[U]?WW[R]?)?\\s+${code}(?:\\s|$|[A-Z])`);
      let match = item.code.match(regex);
      
      if (!match) {
        // Pattern 2: codice sottofamiglia senza spazio
        regex = new RegExp(`^([A-Z]+\\d+)(?:[U]?WW[R]?)?${code}(?:[A-Z]*)?(?:\\s|$)`);
        match = item.code.match(regex);
      }
      
      if (match) {
        baseModel = match[1];
        
        // Determina il codice sottofamiglia con i nuovi raggruppamenti
        if (code === 'GB' || code === 'SU') {
          // Sferiche e Sospensione vanno in "Decorative"
          subfamilyCode = isCurved ? 'DECR' : 'DEC';
        } else if (code === 'SP') {
          // Proiettori orientabili rimangono separati
          subfamilyCode = isCurved ? 'SPR' : 'SP';
        } else if (code === 'OP') {
          // Luci lineari rimangono invariate
          subfamilyCode = 'OP';
        }
        break;
      }
    }
    
    if (baseModel && subfamilyCode) {
      const power = Math.abs(catalog[item.code]?.power || 0);
      
      if (!subfamilies.has(subfamilyCode)) {
        subfamilies.set(subfamilyCode, {
          code: subfamilyCode,
          displayName: subfamilyCode, // Placeholder - verrà sostituito dalla traduzione
          iconItem: item.code,
          models: []
        });
      }
      
      const subfamily = subfamilies.get(subfamilyCode)!;
      
      // Crea il baseModel normalizzato con distinzione dritta/curva
      const normalizedBaseModel = isCurved ? `${baseModel}R` : baseModel;
      
      // Verifica se questo modello esiste già
      const existingModel = subfamily.models.find(m => 
        m.baseModel === normalizedBaseModel && m.power === power
      );
      
      if (!existingModel) {
        subfamily.models.push({
          baseModel: normalizedBaseModel,
          power,
          sampleCode: item.code
        });
      }
    }
  }
  
  // Ordina i modelli per potenza e poi per tipo (dritte prima delle curve)
  for (const subfamily of subfamilies.values()) {
    subfamily.models.sort((a, b) => {
      // Prima ordina per potenza
      if (a.power !== b.power) {
        return a.power - b.power;
      }
      // A parità di potenza, metti le dritte prima delle curve
      const aIsCurved = a.baseModel.endsWith('R');
      const bIsCurved = b.baseModel.endsWith('R');
      if (aIsCurved && !bIsCurved) return 1;
      if (!aIsCurved && bIsCurved) return -1;
      return 0;
    });
  }
  
  return subfamilies;
}

// Funzione per ottenere il nome tradotto della sottofamiglia
export function getSubfamilyName(code: string, translateFn?: (key: string) => string): string {
  if (translateFn) {
    return translateFn(`subfamilies.${code}`);
  }
  
  // Fallback per retrocompatibilità con i nuovi raggruppamenti
  const SUBFAMILY_NAMES: Record<string, string> = {
    'OP': 'Luci lineari',
    'DEC': 'Decorative',          // raggruppa GB (Sferiche) + SU (Sospensione)
    'SP': 'Proiettori orientabili',
    'DECR': 'Decorative curve',   // raggruppa GBR (Sferiche curve) + SUR (Sospensione curvi)
    'SPR': 'Proiettori orientabili curvi',
    
    // Mantieni i vecchi codici per retrocompatibilità
    'GB': 'Sferiche', 
    'SU': 'Sospensione',
    'SUR': 'Sospensione curvi',
  };
  
  return SUBFAMILY_NAMES[code] || code;
}

// Nuovo ordinamento con i raggruppamenti
const SUBFAMILY_ORDER: Record<string, number> = {
  'OP': 1,        // Luci lineari
  'DEC': 2,       // Decorative (ex GB + SU)
  'DECR': 3,      // Decorative curve (ex GBR + SUR)
  'SP': 4,        // Proiettori orientabili
  'SPR': 5,       // Proiettori orientabili curvi
  
  // Mantieni i vecchi codici per retrocompatibilità (con ordini alti)
  'GB': 102,
  'SU': 103,
  'SUR': 104,
};

export function sortSubfamilies(subfamilies: LightSubfamily[]): LightSubfamily[] {
  return subfamilies.sort((a, b) => {
    const orderA = SUBFAMILY_ORDER[a.code] || 999;
    const orderB = SUBFAMILY_ORDER[b.code] || 999;
    return orderA - orderB;
  });
}

// Funzione per verificare se una famiglia ha sottofamiglie
export function hasLightSubfamilies(family: Family): boolean {
  const VALID_SUBFAMILY_CODES = ['OP', 'GB', 'SU', 'SP']; // Mantieni i codici base per il rilevamento
  
  return family.items.some(item => {
    // Cerca uno dei codici sottofamiglia validi nel codice item
    return VALID_SUBFAMILY_CODES.some(code => {
      // Pattern 1: con spazio
      const regex1 = new RegExp(`\\s+${code}(?:\\s|$|[A-Z])`);
      // Pattern 2: senza spazio
      const regex2 = new RegExp(`[A-Z]${code}(?:[A-Z]*)?(?:\\s|$)`);
      
      return regex1.test(item.code) || regex2.test(item.code);
    });
  });
}

// Utility per ottenere i nomi in inglese
export function getSubfamilyNameEN(code: string): string {
  const SUBFAMILY_NAMES_EN: Record<string, string> = {
    'OP': 'Linear lights',
    'DEC': 'Decorative',
    'SP': 'Adjustable spotlights',
    'DECR': 'Decorative curved',
    'SPR': 'Adjustable spotlights curved',
  };
  
  return SUBFAMILY_NAMES_EN[code] || code;
}