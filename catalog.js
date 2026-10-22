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
    id: 'd2', name: 'D2', variantIds: ['d2-30', 'd2-60'],
    image: 'assets/d2-product.png',
    description: 'A first-in-class, synthetic 39-amino-acid peptide that acts as a dual receptor agonist for both GIP (glucose-dependent insulinotropic polypeptide) and GLP-1 (glucagon-like peptide-1) receptors.'
  }
];
