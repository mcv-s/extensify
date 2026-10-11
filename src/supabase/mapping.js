export function mapAddonFileRows(rows) {
  const files = {};
  for (const row of rows ?? []) {
    if (!row || typeof row.path !== 'string' || typeof row.content !== 'string') throw new Error('Supabase addon file row is malformed.');
    if (Object.hasOwn(files, row.path)) throw new Error(`Duplicate Supabase addon path: ${row.path}`);
    files[row.path] = row.content;
  }
  return files;
}

export function mapPublishedAddon(row) {
  if (!row || typeof row.id !== 'string' || typeof row.title !== 'string' || typeof row.description !== 'string') throw new Error('Supabase addon listing row is malformed.');
  return { id: row.id, title: row.title, description: row.description, author_name: row.author_name ?? '', logo: row.logo ?? null, icon_path: row.icon_path ?? null, current_version_id: row.current_version_id ?? null, updated_at: row.updated_at ?? null };
}
