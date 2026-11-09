import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(new URL('../supabase/migrations/202611090001_prune_superseded_addon_versions.sql', import.meta.url), 'utf8');

test('Supabase cleanup is owner-scoped and retains current, draft, and referenced versions', () => {
  assert.match(migration, /security definer/i);
  assert.match(migration, /a\.owner_id\s*=\s*auth\.uid\(\)/i);
  assert.match(migration, /current_version\.published/i);
  assert.match(migration, /v\.published/i);
  assert.match(migration, /v\.created_at < a\.latest_published_at/i);
  assert.match(migration, /v\.id is distinct from a\.current_version_id/i);
  assert.match(migration, /v\.id is distinct from a\.draft_version_id/i);
  assert.match(migration, /referencing_addon\.current_version_id = v\.id/i);
  assert.match(migration, /referencing_addon\.draft_version_id = v\.id/i);
  assert.match(migration, /grant execute on function public\.prune_superseded_addon_versions\(\) to authenticated/i);
  assert.match(migration, /revoke all on function public\.prune_superseded_addon_versions\(\) from public, anon/i);
});