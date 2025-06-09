const express = require('express');
const cors = require('cors');
const { Pool, neonConfig } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-serverless');
const { pgTable, text, timestamp, serial } = require('drizzle-orm/pg-core');
const { eq, and } = require('drizzle-orm');
const path = require('path');
const ws = require('ws');

const __dirname = path.dirname(__filename);

// Neon configuration
neonConfig.webSocketConstructor = ws;

// Database schema
const bookings = pgTable('bookings', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  weekday: text('weekday').notNull(),
  timeSlot: text('time_slot').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Database connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const app = express();
const PORT = parseInt(process.env.PORT || '5000');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// Time slot availability configuration
const timeSlotAvailability = {
  mattina: ['lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi'],
  pomeriggio: ['lunedi', 'martedi', 'mercoledi']
};

const maxBookingsPerSlot = 4;

// API Routes

// Get all bookings
app.get('/api/bookings', async (req, res) => {
  try {
    const allBookings = await db.select().from(bookings);
    res.json(allBookings);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Errore nel caricamento delle prenotazioni' });
  }
});

// Create new booking
app.post('/api/bookings', async (req, res) => {
  try {
    const { name, weekday, timeSlot } = req.body;

    // Validation
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: 'Il nome deve contenere almeno 2 caratteri' });
    }

    if (name.trim().length > 100) {
      return res.status(400).json({ error: 'Il nome non può superare i 100 caratteri' });
    }

    if (!weekday || !timeSlot) {
      return res.status(400).json({ error: 'Giorno e fascia oraria sono obbligatori' });
    }

    // Check if time slot is available for the day
    if (!timeSlotAvailability[timeSlot]?.includes(weekday)) {
      return res.status(400).json({ 
        error: `La fascia oraria non è disponibile per il giorno selezionato` 
      });
    }

    // Check for duplicate booking
    const existingBooking = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.name, name.trim()),
          eq(bookings.weekday, weekday),
          eq(bookings.timeSlot, timeSlot)
        )
      );

    if (existingBooking.length > 0) {
      return res.status(400).json({ 
        error: 'Hai già una prenotazione per questa fascia oraria' 
      });
    }

    // Check slot capacity
    const existingBookingsCount = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.weekday, weekday),
          eq(bookings.timeSlot, timeSlot)
        )
      );

    if (existingBookingsCount.length >= maxBookingsPerSlot) {
      return res.status(400).json({ error: 'Questa fascia oraria è al completo' });
    }

    // Create booking
    const newBooking = await db
      .insert(bookings)
      .values({
        name: name.trim(),
        weekday,
        timeSlot
      })
      .returning();

    res.status(201).json(newBooking[0]);
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Errore durante la creazione della prenotazione' });
  }
});

// Delete booking
app.delete('/api/bookings/:id', async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    
    if (isNaN(bookingId)) {
      return res.status(400).json({ error: 'ID prenotazione non valido' });
    }

    const deletedBooking = await db
      .delete(bookings)
      .where(eq(bookings.id, bookingId))
      .returning();

    if (deletedBooking.length === 0) {
      return res.status(404).json({ error: 'Prenotazione non trovata' });
    }

    res.json({ message: 'Prenotazione eliminata con successo' });
  } catch (error) {
    console.error('Error deleting booking:', error);
    res.status(500).json({ error: 'Errore durante l\'eliminazione della prenotazione' });
  }
});

// Get availability for specific day/time slot
app.get('/api/availability/:weekday/:timeSlot', async (req, res) => {
  try {
    const { weekday, timeSlot } = req.params;

    // Check if time slot is available for the day
    if (!timeSlotAvailability[timeSlot]?.includes(weekday)) {
      return res.json({
        available: false,
        reason: 'unavailable',
        message: 'Fascia oraria non disponibile per questo giorno'
      });
    }

    // Count existing bookings
    const existingBookingsCount = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.weekday, weekday),
          eq(bookings.timeSlot, timeSlot)
        )
      );

    const availableSpots = maxBookingsPerSlot - existingBookingsCount.length;

    if (availableSpots <= 0) {
      return res.json({
        available: false,
        reason: 'full',
        message: 'Fascia oraria completa',
        availableSpots: 0,
        totalSpots: maxBookingsPerSlot
      });
    }

    res.json({
      available: true,
      reason: availableSpots <= 2 ? 'limited' : 'available',
      message: availableSpots <= 2 ? `Solo ${availableSpots} postazioni rimaste` : `${availableSpots} postazioni disponibili`,
      availableSpots,
      totalSpots: maxBookingsPerSlot
    });
  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({ error: 'Errore nel controllo disponibilità' });
  }
});

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});