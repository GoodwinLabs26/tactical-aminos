import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { products } from '../catalog.js';
const root = new URL('../', import.meta.url);
await mkdir(new URL('functions/lib/', root), { recursive: true });
await copyFile(new URL('shared/checkout-core.js', root), new URL('functions/lib/checkout-core.js', root));
await writeFile(new URL('functions/lib/catalog-draft.json', root), JSON.stringify(products.map(product => ({ ...product, priceCents: Math.round(product.price * 100), compoundKey: product.name.toLowerCase(), bulkEligible: true, stockQuantity: 0, lowStockThreshold: 10, published: true })),null,2));
console.log('Copied shared checkout validation into the Functions bundle.');
