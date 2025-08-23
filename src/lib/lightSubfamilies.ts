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
  
  for (const item of family.items) {
    // ⭐ USA DIRETTAMENTE LA COLONNA sottofamiglia
    console.log(item.sottofamiglia);
    if (!item.sottofamiglia) {
      continue; // Salta se non ha sottofamiglia definita
    }
    
    const subfamilyDisplayName = item.sottofamiglia;
    const subfamilyCode = getSubfamilyCodeFromName(subfamilyDisplayName);
    const power = Math.abs(catalog[item.code]?.power || 0);
    
    // Estrai il modello base dal codice (logica esistente)
    const baseModelMatch = item.code.match(/^([A-Z]+\d+)/);
    if (!baseModelMatch) continue;
    
    const baseModel = baseModelMatch[1];
    const isCurved = item.code.includes('WWR') || item.code.includes('UWWR') || item.code.includes('NWR');
    const normalizedBaseModel = isCurved ? `${baseModel}R` : baseModel;
    
    if (!subfamilies.has(subfamilyCode)) {
      subfamilies.set(subfamilyCode, {
        code: subfamilyCode,
        displayName: subfamilyDisplayName, // ⭐ USA IL NOME DAL DB
        iconItem: item.code,
        models: []
      });
    }
    
    const subfamily = subfamilies.get(subfamilyCode)!;
    
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

// ⭐ NUOVA FUNZIONE per mappare nome → codice per ordinamento
function getSubfamilyCodeFromName(displayName: string): string {
  const NAME_TO_CODE: Record<string, string> = {
    // Nomi italiani
    'Luci lineari': 'OP',
    'Decorative': 'DEC',
    'Decorative curve': 'DECR', 
    'Proiettori orientabili': 'SP',
    'Proiettori orientabili curvi': 'SPR',
    'Proiettori orientabili zoomabili': 'SPZ',
    'Proiettori orientabili zoomabili curvi': 'SPZR',
    
    // Se usi anche nomi inglesi nel DB, aggiungili qui
    'Linear lights': 'OP',
    'Decorative curved': 'DECR',
    'Adjustable spotlights': 'SP',
    'Adjustable spotlights curved': 'SPR',
    'Adjustable zoomable spotlights': 'SPZ',
    'Adjustable zoomable spotlights curved': 'SPZR',
  };
  
  return NAME_TO_CODE[displayName] || displayName.replace(/\s+/g, '_').toUpperCase();
}

// Funzione per ottenere il nome tradotto della sottofamiglia (ora deprecata ma mantenuta per compatibilità)
export function getSubfamilyName(code: string, translateFn?: (key: string) => string): string {
  if (translateFn) {
    return translateFn(`subfamilies.${code}`);
  }
  
  // Fallback - ora questi nomi vengono dal DB
  const SUBFAMILY_NAMES: Record<string, string> = {
    'OP': 'Luci lineari',
    'DEC': 'Decorative',
    'DECR': 'Decorative curve',
    'SP': 'Proiettori orientabili',
    'SPR': 'Proiettori orientabili curvi',
    'SPZ': 'Proiettori orientabili zoomabili',
    'SPZR': 'Proiettori orientabili zoomabili curvi',
  };
  
  return SUBFAMILY_NAMES[code] || code;
}

// Ordinamento basato sui codici
const SUBFAMILY_ORDER: Record<string, number> = {
  'OP': 1,
  'DEC': 2,
  'DECR': 3,
  'SP': 4,
  'SPR': 5,
  'SPZ': 6,
  'SPZR': 7,
};

export function sortSubfamilies(subfamilies: LightSubfamily[]): LightSubfamily[] {
  return subfamilies.sort((a, b) => {
    const orderA = SUBFAMILY_ORDER[a.code] || 999;
    const orderB = SUBFAMILY_ORDER[b.code] || 999;
    return orderA - orderB;
  });
}

// ⭐ SEMPLIFICATA - usa solo la colonna sottofamiglia
export function hasLightSubfamilies(family: Family): boolean {
  for (let item of family.items) {
    console.log(item.code);
  }
  return family.items.some(item => item.sottofamiglia !== undefined && item.sottofamiglia !== null);
}