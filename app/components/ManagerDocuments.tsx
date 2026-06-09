'use client'

import { useState, useEffect, useRef } from 'react'

type Doc = {
  id: string
  manager_name: string
  file_name: string
  file_url: string
  file_type: string
  file_size: number
  note: string | null
  uploaded_by: string | null
  created_at: string
}

function fmtSize(bytes: number) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  if (bytes >= 1_000)     return `${(bytes / 1_000).toFixed(0)} KB`
  return `${bytes} B`
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

function fileIcon(type: string) {
  if (type.startsWith('image/'))       return '🖼️'
  if (type === 'application/pdf')      return '📄'
  if (type.includes('word'))           return '📝'
  if (type.includes('sheet') || type.includes('excel')) return '📊'
  if (type.includes('presentation') || type.includes('powerpoint')) return '📑'
  return '📎'
}

export default function ManagerDocuments({
  managerName,
  uploaderName,
  color = '#94a3b8',
}: {
  managerName: string
  uploaderName: string
  color?: string
}) {
  const [docs, setDocs]           = useState<Doc[]>([])
  const [loading, setLoading]     = useState(true)
  const [uploading, setUploading] = useState(false)
  const [note, setNote]           = useState('')
  const [error, setError]         = useState<string | null>(null)
  const [deleting, setDeleting]   = useState<string | null>(null)
  const fileRef                   = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    try {
      const res  = await fetch(`/api/manager-docs?manager=${encodeURIComponent(managerName)}`)
      const data = await res.json()
      setDocs(Array.isArray(data) ? data : [])
    } catch {
      setError('Failed to load documents.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [managerName])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file',        file)
      form.append('manager',     managerName)
      form.append('note',        note.trim())
      form.append('uploaded_by', uploaderName)
      const res = await fetch('/api/manager-docs', { method: 'POST', body: form })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Upload failed') }
      setNote('')
      if (fileRef.current) fileRef.current.value = ''
      await load()
    } catch (err: any) {
      setError(err.message ?? 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      await fetch(`/api/manager-docs?id=${id}`, { method: 'DELETE' })
      setDocs((prev) => prev.filter((d) => d.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3"
        style={{ borderLeftWidth: 3, borderLeftColor: color }}>
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
          <span className="text-sm font-bold text-gray-900">Documents</span>
          {docs.length > 0 && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
              {docs.length}
            </span>
          )}
        </div>
      </div>

      {/* Upload area */}
      <div className="border-b border-gray-50 px-5 py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-semibold text-gray-500">Note (optional)</label>
            <div className="flex items-center gap-1.5">
              {/* Pencil icon */}
              <div className="pointer-events-none flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
                <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H8v-2.414a2 2 0 01.586-1.414z" />
                </svg>
              </div>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') setNote('') }}
                placeholder="Add a note for this document…"
                className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:bg-white focus:outline-none transition-colors"
              />
              {/* Confirm (✓) button — visible when note has content */}
              {note.trim() && (
                <button
                  type="button"
                  onClick={() => {/* note is stored on upload — this just gives visual confirmation */}}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-green-200 bg-green-50 text-green-500 transition-colors hover:bg-green-100"
                  title="Note ready"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label
              className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors ${uploading ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90'}`}
              style={{ backgroundColor: color }}
            >
              {uploading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Uploading…
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Attach File
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                disabled={uploading}
                onChange={handleUpload}
              />
            </label>
          </div>
        </div>
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      </div>

      {/* Document list */}
      {loading ? (
        <div className="px-5 py-8 text-center text-sm text-gray-400">Loading…</div>
      ) : docs.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-gray-400">
          No documents attached yet. Upload the first one above.
        </div>
      ) : (
        <ul className="divide-y divide-gray-50">
          {docs.map((doc) => (
            <li key={doc.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
              {/* Icon */}
              <span className="mt-0.5 text-xl leading-none">{fileIcon(doc.file_type)}</span>

              {/* Details */}
              <div className="min-w-0 flex-1">
                {/* File name + size */}
                <div className="flex items-center gap-2">
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-sm font-semibold text-blue-600 hover:underline"
                  >
                    {doc.file_name}
                  </a>
                  <span className="shrink-0 text-xs text-gray-400">{fmtSize(doc.file_size)}</span>
                </div>

                {/* Note */}
                {doc.note && (
                  <div className="mt-1 flex items-start gap-1.5">
                    <svg className="mt-0.5 h-3 w-3 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H8v-2.414a2 2 0 01.586-1.414z" />
                    </svg>
                    <p className="text-xs text-gray-700">{doc.note}</p>
                  </div>
                )}

                {/* Timestamp + uploader */}
                <div className="mt-1 flex items-center gap-1.5">
                  <svg className="h-3 w-3 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs font-medium text-gray-500">{fmtDate(doc.created_at)}</span>
                  {doc.uploaded_by && (
                    <span className="text-xs text-gray-400">· by <span className="font-medium text-gray-500">{doc.uploaded_by}</span></span>
                  )}
                </div>
              </div>

              {/* Delete */}
              <button
                onClick={() => handleDelete(doc.id)}
                disabled={deleting === doc.id}
                className="mt-0.5 shrink-0 rounded-lg p-1 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-400 disabled:opacity-40"
                title="Remove document"
              >
                {deleting === doc.id ? (
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
