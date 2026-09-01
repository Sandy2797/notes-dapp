import { and, desc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, members, notes, tips, toClientNote, toClientTip } from '@/lib/db'

export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get('name')?.trim()
  if (!name) return NextResponse.json({ error: 'Name is required.' }, { status: 400 })
  await db.insert(members).values({ name }).onConflictDoNothing()
  const [owned, feed, member, history, allMembers] = await Promise.all([
    db.select().from(notes).where(eq(notes.ownerName, name)).orderBy(desc(notes.createdAt)),
    db.select().from(notes).where(eq(notes.isShared, true)).orderBy(desc(notes.createdAt)),
    db.select().from(members).where(eq(members.name, name)),
    db.select().from(tips).orderBy(desc(tips.createdAt)).limit(100),
    db.select().from(members),
  ])
  return NextResponse.json({ notes: owned.map(toClientNote), feed: feed.map(toClientNote), balance: member[0]?.balance ?? 100, tips: history.map(toClientTip), ledger: { members: allMembers.length, circulation: allMembers.reduce((sum, item) => sum + item.balance, 0), expectedSupply: allMembers.length * 100 } })
}

export async function POST(request: Request) {
  const body = await request.json() as { action?: string; name?: string; title?: string; content?: string; id?: string; recipient?: string; amount?: number }
  const name = body.name?.trim()
  if (!name) return NextResponse.json({ error: 'Name is required.' }, { status: 400 })
  await db.insert(members).values({ name }).onConflictDoNothing()
  if (body.action === 'create') {
    if (!body.title?.trim() || !body.content?.trim()) return NextResponse.json({ error: 'Title and content are required.' }, { status: 400 })
    const [note] = await db.insert(notes).values({ ownerName: name, title: body.title.trim(), content: body.content.trim() }).returning()
    return NextResponse.json({ note: toClientNote(note) })
  }
  if (body.action === 'share') {
    const [note] = await db.update(notes).set({ isShared: true }).where(and(eq(notes.id, Number(body.id)), eq(notes.ownerName, name))).returning()
    return NextResponse.json({ note: toClientNote(note) })
  }
  if (body.action === 'unshare') {
    const [note] = await db.update(notes).set({ isShared: false }).where(and(eq(notes.id, Number(body.id)), eq(notes.ownerName, name))).returning()
    return NextResponse.json({ note: toClientNote(note) })
  }
  if (body.action === 'delete') {
    await db.delete(notes).where(and(eq(notes.id, Number(body.id)), eq(notes.ownerName, name)))
    return NextResponse.json({ ok: true })
  }
  if (body.action === 'tip') {
    const amount = body.amount
    const recipient = body.recipient?.trim()
    if (!recipient || recipient === name) return NextResponse.json({ error: 'You cannot tip yourself.' }, { status: 400 })
    if (!Number.isInteger(amount) || (amount as number) <= 0) return NextResponse.json({ error: 'Tips must be positive whole points.' }, { status: 400 })
    const result = await db.transaction(async (tx) => {
      const [sender] = await tx.select().from(members).where(eq(members.name, name))
      if (!sender || sender.balance < (amount as number)) throw new Error(`Insufficient points. Your balance is ${sender?.balance ?? 0}.`)
      await tx.insert(members).values({ name: recipient, balance: 100 }).onConflictDoNothing()
      await tx.update(members).set({ balance: sender.balance - (amount as number) }).where(eq(members.name, name))
      await tx.update(members).set({ balance: (await tx.select().from(members).where(eq(members.name, recipient)))[0].balance + (amount as number) }).where(eq(members.name, recipient))
      const [tip] = await tx.insert(tips).values({ senderName: name, recipientName: recipient, amount: amount as number }).returning()
      return tip
    }).catch((error: Error) => ({ error: error.message }))
    if ('error' in result) return NextResponse.json(result, { status: 400 })
    return NextResponse.json({ tip: toClientTip(result) })
  }
  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
}
