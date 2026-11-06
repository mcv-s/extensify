import { normalizePath, validatePackage } from '../addons/validation.js';
import { upgradeAddonPackage } from '../addons/metadata.js';

export async function importAddonFolder(fileList) {
  const selectedFiles=Array.from(fileList ?? []);
  if (!selectedFiles.length) throw new Error('Choose a folder containing an addon package.');
  if (selectedFiles.length > 100) throw new Error('Addon folders are limited to 100 files.');
  const files={};
  let totalSize=0;
  for (const file of selectedFiles) {
    const relativePath=file.webkitRelativePath || file.name;
    const segments=relativePath.split('/');
    const packagePath=segments.length>1?segments.slice(1).join('/'):relativePath;
    const path=normalizePath(packagePath);
    if (Object.hasOwn(files,path)) throw new Error(`Duplicate file path: ${path}`);
    if (file.size>2*1024*1024) throw new Error(`${path} exceeds the 2 MB file limit.`);
    totalSize+=file.size;
    if (totalSize>10*1024*1024) throw new Error('Addon folder expands beyond the 10 MB total limit.');
    files[path]=await file.text();
  }
  let config;
  try { config=JSON.parse(files['config.json'] ?? ''); }
  catch { throw new Error('Folder must contain a valid root config.json.'); }
  const upgraded=upgradeAddonPackage(config,files);
  const checked=validatePackage(upgraded.config,upgraded.files);
  if (!checked.valid) throw new Error(checked.errors.join('\n'));
  return { config:upgraded.config, files:checked.files };
}