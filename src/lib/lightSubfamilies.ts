import type { Family, FamilyEntry, CatalogEntry } from '../app';

export interface LightSubfamily {
  code: string;
  displayName: string;
  iconItem: string;
  models: Array<{
    baseModel: string;
    power: number;
    sampleCode: string;
  }>;
}

export function extractSubfamilies(family: Family, catalog: Record<string, CatalogEntry>): Map<string, LightSubfamily> {
  const subfamilies = new Map<string, LightSubfamily>();
  
  for (const item of family.items) {
    if (!item.sottofamiglia) {
      continue;
    }
    
    const subfamilyDisplayName = item.sottofamiglia;
    const subfamilyCode = getSubfamilyCodeFromName(subfamilyDisplayName);
    const power = Math.abs(catalog[item.code]?.power || 0);
    const baseModelMatch = item.code.match(/^([A-Z]+\d+)/);
    if (!baseModelMatch) continue;
    
    const baseModel = baseModelMatch[1];
    const isCurved = item.code.includes('WWR') || item.code.includes('UWWR') || item.code.includes('NWR');
    const normalizedBaseModel = isCurved ? `${baseModel}R` : baseModel;
    
    if (!subfamilies.has(subfamilyCode)) {
      subfamilies.set(subfamilyCode, {
        code: subfamilyCode,
        displayName: subfamilyDisplayName,
        iconItem: item.code,
        models: []
      });
    }
    
    const subfamily = subfamilies.get(subfamilyCode)!;
    
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
  
  for (const subfamily of subfamilies.values()) {
    subfamily.models.sort((a, b) => {
      if (a.power !== b.power) {
        return a.power - b.power;
      }
      const aIsCurved = a.baseModel.endsWith('R');
      const bIsCurved = b.baseModel.endsWith('R');
      if (aIsCurved && !bIsCurved) return 1;
      if (!aIsCurved && bIsCurved) return -1;
      return 0;
    });
  }
  
  return subfamilies;
}

function getSubfamilyCodeFromName(displayName: string): string {
  const NAME_TO_CODE: Record<string, string> = {
    'Luci lineari': 'OP',
    'Luci lineari per profili curvi': 'OPR',
    'Proiettori lineari': 'LPR',
    'Luci decorative': 'DEC',
    'Luci decorative curve': 'DECR',
    'Proiettori orientabili': 'SP',
    'Proiettori orientabili curvi': 'SPR',
    'Proiettori orientabili zoomabili': 'SPZ',
    'Proiettori orientabili zoomabili curvi': 'SPZR',
    'Proiettori orientabili con forma': 'FPR',
    'Proiettori lineari orientabili': 'ALPR',

    'Linear lights': 'OP',
    'Linear lights for curved profiles': 'OPR',
    'Linear projectors': 'LPR',
    'Decorative lights': 'DEC',
    'Curved decorative lights': 'DECR',
    'Adjustable projectors': 'SP',
    'Adjustable curved projectors': 'SPR',
    'Adjustable zoomable projectors': 'SPZ',
    'Adjustable zoomable curved projectors': 'SPZR',
    'Shape adjustable projectors': 'FPR',
    'Adjustable linear projectors': 'ALPR',
  };

  return NAME_TO_CODE[displayName] || displayName.replace(/\s+/g, '_').toUpperCase();
}

export function getSubfamilyName(code: string, translateFn?: (key: string) => string): string {
  if (translateFn) {
    return translateFn(`subfamilies.${code}`);
  }

  const SUBFAMILY_NAMES: Record<string, string> = {
    'OP': 'Luci lineari',
    'OPR': 'Luci lineari per profili curvi',
    'LPR': 'Proiettori lineari',
    'DEC': 'Luci decorative',
    'DECR': 'Luci decorative curve',
    'SP': 'Proiettori orientabili',
    'SPR': 'Proiettori orientabili curvi',
    'SPZ': 'Proiettori orientabili zoomabili',
    'SPZR': 'Proiettori orientabili zoomabili curvi',
    'FPR': 'Proiettori orientabili con forma',
    'ALPR': 'Proiettori lineari orientabili',
  };

  return SUBFAMILY_NAMES[code] || code;
}

const SUBFAMILY_ORDER: Record<string, number> = {
  'OP': 1,
  'OPR': 2,
  'LPR': 3,
  'ALPR': 4,
  'DEC': 5,
  'DECR': 6,
  'SP': 7,
  'SPR': 8,
  'SPZ': 9,
  'SPZR': 10,
  'FPR': 11,
};

export function sortSubfamilies(subfamilies: LightSubfamily[]): LightSubfamily[] {
  return subfamilies.sort((a, b) => {
    const orderA = SUBFAMILY_ORDER[a.code] || 999;
    const orderB = SUBFAMILY_ORDER[b.code] || 999;
    return orderA - orderB;
  });
}

export function hasLightSubfamilies(family: Family): boolean {
  return family.items.some(item => item.sottofamiglia !== undefined && item.sottofamiglia !== null);
}