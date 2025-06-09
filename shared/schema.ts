import { pgTable, text, timestamp, integer, serial } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const bookings = pgTable('bookings', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  weekday: text('weekday').notNull(),
  timeSlot: text('time_slot').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = typeof bookings.$inferInsert;