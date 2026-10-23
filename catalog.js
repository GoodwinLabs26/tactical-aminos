// Provisional examples transcribed from the supplied Numbers preview.
// These samples are bundled public data; production inventory/prices will move
// to authenticated Firestore reads in the catalog/order phase.
export const categories = [
  { id: 'all', name: 'All products' },
  { id: 'compounds', name: 'Compounds' },
  { id: 'regulators', name: 'Regulators' },
  { id: 'blends', name: 'Blends' }
];
export const products = [
  // NAD+ strengths and prices confirmed by Jasmine on October 23, 2026.
  { id: 'nad-250', name: 'NAD+', strength: '250mg', price: 40, category: 'compounds' },
  { id: 'nad-500', name: 'NAD+', strength: '500mg', price: 75, category: 'compounds' },
  { id: 'nad-1000', name: 'NAD+', strength: '1000mg', price: 110, category: 'compounds' },
  { id: 'd2-30', name: 'D2', strength: '30mg', price: 150, category: 'regulators' },
  { id: 'd2-60', name: 'D2', strength: '60mg', price: 240, category: 'regulators' },
  { id: 'r3-20', name: 'R3', strength: '20mg', price: 145, category: 'regulators' },
  { id: 'r3-30', name: 'R3', strength: '30mg', price: 200, category: 'regulators' },
  { id: 'bpc-tb', name: 'BPC-157 / TB-500', strength: '5/5mg', price: 55, category: 'blends' },
  { id: 'bpc157', name: 'BPC-157', strength: '10mg', price: 38, category: 'compounds' },
  { id: 'tb4', name: 'TB-4', strength: '10mg', price: 50, category: 'compounds' },
  { id: 'kpv', name: 'KPV', strength: '10mg', price: 45, category: 'compounds' },
  { id: 'cjc-ipa', name: 'CJC-1295 NoDAC / Ipamorelin', strength: '5/5mg', price: 55, category: 'blends' },
  { id: 'cjc-nodac', name: 'CJC-1295 NoDAC', strength: '10mg', price: 50, category: 'compounds' },
  { id: 'cjc-dac', name: 'CJC-1295 w/DAC', strength: '5mg', price: 50, category: 'compounds' },
  { id: 'ipamorelin', name: 'Ipamorelin', strength: '10mg', price: 55, category: 'compounds' },
  { id: 'tesamorelin', name: 'Tesamorelin', strength: '10mg', price: 70, category: 'compounds' },
  { id: 'melanotan1', name: 'Melanotan-I', strength: '10mg', price: 35, category: 'compounds' },
  { id: 'melanotan2', name: 'Melanotan-II', strength: '10mg', price: 35, category: 'compounds' }
];

// Storefront presentation only: each strength keeps its original SKU, price,
// inventory and order history. Add other families here as they are reviewed.
export const productFamilies = [
  {
    id: 'nad', name: 'NAD+', variantIds: ['nad-250', 'nad-500', 'nad-1000'],
    image: 'assets/nad-product.png',
    description: 'NAD+ (nicotinamide adenine dinucleotide) is a naturally occurring coenzyme involved in cellular energy metabolism, DNA repair pathways, and mitochondrial function. It consists of two nucleotides linked through phosphate groups, rather than a chain of amino acids.',
    sections: [
      {
        title: 'Mechanism of action',
        items: [
          'Cellular energy metabolism: NAD+ accepts electrons during oxidation–reduction reactions. Its reduced form, NADH, supplies electrons to mitochondrial pathways involved in ATP production.',
          'Enzyme activity: NAD+ serves as a substrate for enzymes including sirtuins and PARPs, which participate in cellular regulation, stress responses, and DNA repair pathways.'
        ]
      }
    ]
  },
  {
    id: 'd2', name: 'D2', variantIds: ['d2-30', 'd2-60'],
    image: 'assets/d2-product.png',
    description: 'A first-in-class, synthetic 39-amino-acid peptide that acts as a dual receptor agonist for both GIP (glucose-dependent insulinotropic polypeptide) and GLP-1 (glucagon-like peptide-1) receptors.'
  },
  {
    id: 'r3', name: 'R3', variantIds: ['r3-20', 'r3-30'],
    image: 'assets/r3-product.png',
    description: 'An investigational, once-weekly injectable peptide (a chain of amino acids).'
  }
];
