/**
 * Grant (or revoke) an admin role from the command line — the ONLY way admins are created. Nobody can become
 * an admin through the website. The person must already have an account.
 *
 *   node scripts/make-admin.mjs someone@gmail.com              -> SUPER_ADMIN
 *   node scripts/make-admin.mjs someone@gmail.com ADMIN        -> a specific role
 *   node scripts/make-admin.mjs someone@gmail.com --revoke     -> remove all admin roles
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const [email, arg] = process.argv.slice(2)
if (!email) { console.error('Usage: node scripts/make-admin.mjs <email> [ROLE|--revoke]'); process.exit(1) }
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 })
const user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
if (!user) { console.error(`No account for ${email}. Sign up on the site first, then run this again.`); process.exit(1) }
const { data: profile } = await db.from('profiles').select('id').eq('auth_user_id', user.id).single()

if (arg === '--revoke') {
  await db.from('admin_roles').update({ is_active: false }).eq('profile_id', profile.id)
  console.log(`Removed all admin roles from ${email}`)
} else {
  const role = arg || 'SUPER_ADMIN'
  const { error } = await db.from('admin_roles').upsert({ profile_id: profile.id, role, is_active: true }, { onConflict: 'profile_id,role' })
  if (error) { console.error(error.message); process.exit(1) }
  console.log(`${email} is now ${role}. They will see "Admin panel" in their account menu.`)
}
