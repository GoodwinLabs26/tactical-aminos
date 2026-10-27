import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { products } from '../catalog.js';
import {isProductReady,productPriceCents} from '../product-availability.js';
const root = new URL('../', import.meta.url);
await mkdir(new URL('functions/lib/', root), { recursive: true });
await copyFile(new URL('shared/checkout-core.js', root), new URL('functions/lib/checkout-core.js', root));
await copyFile(new URL('reports-core.js', root), new URL('functions/lib/reports-core.js', root));
await writeFile(new URL('functions/lib/catalog-draft.json', root), JSON.stringify(products.map(product => ({ ...product, priceCents: productPriceCents(product), compoundKey: product.name.toLowerCase(), bulkEligible: true, stockQuantity: 0, lowStockThreshold: 10, published: isProductReady(product) })),null,2));
console.log('Copied shared checkout validation into the Functions bundle.');
