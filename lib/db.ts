import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

export const notes = pgTable('notes', { id: serial('id').primaryKey(), ownerName: text('owner_name').notNull(), title: text('title').notNull(), content: text('content').notNull(), imageUrl: text('image_url'), isShared: boolean('is_shared').notNull().default(false), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow() })
export const members = pgTable('members', { name: text('name').primaryKey(), balance: integer('balance').notNull().default(100), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow() })
export const tips = pgTable('tips', { id: serial('id').primaryKey(), senderName: text('sender_name').notNull(), recipientName: text('recipient_name').notNull(), amount: integer('amount').notNull(), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow() })

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
export const db = drizzle(pool)
export type Note = typeof notes.$inferSelect
export type Tip = typeof tips.$inferSelect

export function toClientNote(note: Note) { return { id: String(note.id), title: note.title, content: note.content, owner: note.ownerName, shared: note.isShared, imageUrl: note.imageUrl ?? null, updated: note.createdAt.toISOString() } }
export function toClientTip(tip: Tip) { return { id: String(tip.id), from: tip.senderName, to: tip.recipientName, amount: tip.amount, created: tip.createdAt.toISOString() } }
