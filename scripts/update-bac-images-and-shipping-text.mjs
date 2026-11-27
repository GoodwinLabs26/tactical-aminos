import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const edits=[];
function edit(file,transform){const path=resolve(root,file),before=readFileSync(path,'utf8'),after=transform(before);if(before!==after)edits.push({path,after});}
for(const name of ['bac-water-10-updated.png','hospira-bac-30-updated.png'])if(!existsSync(resolve(root,'assets',name)))throw new Error('Missing replacement image: '+name);
edit('catalog.js',source=>{
  for(const [oldPath,newPath] of [['assets/bac-water-10-product.png','assets/bac-water-10-updated.png'],['assets/hospira-bac-30-product.png','assets/hospira-bac-30-updated.png']]){
    if(!source.includes(oldPath)&&!source.includes(newPath))throw new Error('Expected image reference not found: '+oldPath+'. No source files changed.');
    source=source.replaceAll(oldPath,newPath);
  }
  return source;
});
edit('admin.js',source=>source
  .replace(/<p\b[^>]*>\s*Tracking email:\s*not connected\s*<\/p>/gi,'')
  .replaceAll('Tracking will be saved. Email delivery is not connected yet.','Tracking will be saved. The first time a paid order is marked shipped, a shipping email is triggered. Updating tracking later does not send another email.'));
edit('functions/admin-service.js',source=>source
  .replaceAll('Tracking saved. Email delivery is not connected yet.','Tracking saved.')
  .replaceAll(",trackingEmailStatus:'not-connected'",''));
// Apply only targeted edits to current files, preserving later login/admin updates.
for(const {path,after} of edits)writeFileSync(path,after);
console.log('Updated BAC Water image references and removed obsolete shipping-email wording.');
console.log('The blue image is Tactical Aminos BAC Water; the red image is Hospira BAC Water.');
