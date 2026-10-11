export function isMissingColumn(error, table, column) {
  const message=String(error?.message ?? error ?? '');
  const quotedTable=table.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const quotedColumn=column.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return error?.code==='42703' || error?.code==='PGRST204'
    || new RegExp(`column\\s+["']?(?:public\\.)?${quotedTable}\\.${quotedColumn}["']?\\s+does not exist`,'i').test(message)
    || new RegExp(`could not find the ["']?${quotedColumn}["']? column of ["']?${quotedTable}["']?`,'i').test(message);
}
