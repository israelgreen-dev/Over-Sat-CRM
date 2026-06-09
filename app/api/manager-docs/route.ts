/**
 * /api/manager-docs
 * GET  ?manager=<name>   — list documents for a manager
 * POST (multipart)       — upload a new document
 * DELETE ?id=<id>        — delete a document + its storage file
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const manager = req.nextUrl.searchParams.get('manager')
  if (!manager) return NextResponse.json({ error: 'manager required' }, { status: 400 })

  const sb = adminClient()
  const { data, error } = await sb
    .from('manager_documents')
    .select('*')
    .eq('manager_name', manager)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const form = await req.formData()
  const file    = form.get('file') as File | null
  const manager = form.get('manager') as string | null
  const note    = (form.get('note') as string | null) ?? ''
  const uploadedBy = (form.get('uploaded_by') as string | null) ?? ''

  if (!file || !manager) {
    return NextResponse.json({ error: 'file and manager are required' }, { status: 400 })
  }

  const sb = adminClient()

  // Upload file to Supabase Storage
  const ext      = file.name.split('.').pop() ?? 'bin'
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path     = `${manager}/${Date.now()}_${safeName}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: storageError } = await sb.storage
    .from('manager-docs')
    .upload(path, arrayBuffer, { contentType: file.type, upsert: false })

  if (storageError) return NextResponse.json({ error: storageError.message }, { status: 500 })

  // Get public URL
  const { data: { publicUrl } } = sb.storage.from('manager-docs').getPublicUrl(path)

  // Insert metadata row
  const { data: row, error: dbError } = await sb
    .from('manager_documents')
    .insert({
      manager_name:  manager,
      file_name:     file.name,
      file_path:     path,
      file_url:      publicUrl,
      file_type:     file.type,
      file_size:     file.size,
      note,
      uploaded_by:   uploadedBy,
    })
    .select()
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json(row, { status: 201 })
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const sb = adminClient()

  // Fetch the row to get the storage path
  const { data: doc, error: fetchError } = await sb
    .from('manager_documents')
    .select('file_path')
    .eq('id', id)
    .single()

  if (fetchError || !doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  // Delete from storage
  await sb.storage.from('manager-docs').remove([doc.file_path])

  // Delete metadata row
  const { error: dbError } = await sb.from('manager_documents').delete().eq('id', id)
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
