const API_BASE_URL = 'https://prenotazioni-4.onrender.com';
/**
 * Sistema di prenotazione postazioni biblioteca
 * Gestisce prenotazioni con database online e aggiornamenti real-time
 */

class LibraryBookingSystem {
    constructor() {
        this.bookings = [];
        this.maxBookingsPerSlot = 4;
        this.timeSlotAvailability = {
            mattina: ['lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi'],
            pomeriggio: ['lunedi', 'martedi', 'mercoledi']
        };
        
        this.initializeEventListeners();
        this.loadBookings();
        this.updateAvailabilityInfo();
        this.initializeWeeklyTable();
    }

    /**
     * Inizializza gli event listeners per il form
     */
    initializeEventListeners() {
        const form = document.getElementById('bookingForm');
        const weekdaySelect = document.getElementById('weekday');
        const timeSlotSelect = document.getElementById('timeSlot');

        form.addEventListener('submit', (e) => this.handleFormSubmit(e));
        weekdaySelect.addEventListener('change', () => this.updateTimeSlotOptions());
        timeSlotSelect.addEventListener('change', () => this.updateAvailabilityInfo());
        weekdaySelect.addEventListener('change', () => this.updateAvailabilityInfo());
    }

    /**
     * Carica le prenotazioni dal database
     */
    async loadBookings() {
        try {
            const response = await fetch('/api/bookings');
            if (!response.ok) {
                throw new Error('Errore nel caricamento delle prenotazioni');
            }
            this.bookings = await response.json();
            this.updateActiveBookingsDisplay();
            this.updateAvailabilityInfo();
            this.updateWeeklyTable();
        } catch (error) {
            console.error('Errore nel caricamento delle prenotazioni:', error);
            this.showNotification('Errore nel caricamento delle prenotazioni', 'error');
        }
    }

    /**
     * Crea una nuova prenotazione nel database
     */
    async saveBooking(bookingData) {
        try {
            const response = await fetch('/api/bookings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(bookingData),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Errore durante la prenotazione');
            }

            return await response.json();
        } catch (error) {
            console.error('Errore nel salvataggio della prenotazione:', error);
            throw error;
        }
    }

    /**
     * Aggiorna le opzioni delle fasce orarie in base al giorno selezionato
     */
    updateTimeSlotOptions() {
        const weekday = document.getElementById('weekday').value;
        const timeSlotSelect = document.getElementById('timeSlot');
        const mattinaOption = timeSlotSelect.querySelector('option[value="mattina"]');
        const pomeriggioOption = timeSlotSelect.querySelector('option[value="pomeriggio"]');

        if (!weekday) {
            // Reset se nessun giorno è selezionato
            mattinaOption.disabled = false;
            pomeriggioOption.disabled = false;
            timeSlotSelect.value = '';
            this.updateAvailabilityInfo();
            return;
        }

        // Controlla disponibilità mattina
        mattinaOption.disabled = !this.timeSlotAvailability.mattina.includes(weekday);
        
        // Controlla disponibilità pomeriggio
        pomeriggioOption.disabled = !this.timeSlotAvailability.pomeriggio.includes(weekday);

        // Reset selezione se la fascia oraria non è più disponibile
        const currentTimeSlot = timeSlotSelect.value;
        if (currentTimeSlot === 'mattina' && mattinaOption.disabled) {
            timeSlotSelect.value = '';
        } else if (currentTimeSlot === 'pomeriggio' && pomeriggioOption.disabled) {
            timeSlotSelect.value = '';
        }

        this.updateAvailabilityInfo();
    }

    /**
     * Aggiorna le informazioni di disponibilità
     */
    async updateAvailabilityInfo() {
        const weekday = document.getElementById('weekday').value;
        const timeSlot = document.getElementById('timeSlot').value;
        const availabilityInfo = document.getElementById('availabilityInfo');

        if (!weekday || !timeSlot) {
            availabilityInfo.style.display = 'none';
            return;
        }

        try {
            const response = await fetch(`/api/availability/${weekday}/${timeSlot}`);
            if (!response.ok) {
                throw new Error('Errore nel controllo disponibilità');
            }

            const availability = await response.json();

            if (!availability.available) {
                if (availability.reason === 'unavailable') {
                    availabilityInfo.className = 'availability-info unavailable';
                    availabilityInfo.innerHTML = `
                        <i class="fas fa-times-circle"></i>
                        La fascia oraria "${this.getTimeSlotDisplayName(timeSlot)}" non è disponibile per ${this.getWeekdayDisplayName(weekday)}
                    `;
                } else if (availability.reason === 'full') {
                    availabilityInfo.className = 'availability-info full';
                    availabilityInfo.innerHTML = `
                        <i class="fas fa-exclamation-triangle"></i>
                        Fascia oraria completa! Non ci sono postazioni disponibili.
                    `;
                }
            } else {
                if (availability.reason === 'limited') {
                    availabilityInfo.className = 'availability-info limited';
                    availabilityInfo.innerHTML = `
                        <i class="fas fa-info-circle"></i>
                        Attenzione: Solo ${availability.availableSpots} postazione/i rimaste per questa fascia oraria.
                    `;
                } else {
                    availabilityInfo.className = 'availability-info available';
                    availabilityInfo.innerHTML = `
                        <i class="fas fa-check-circle"></i>
                        Postazioni disponibili: ${availability.availableSpots} su ${availability.totalSpots}
                    `;
                }
            }
        } catch (error) {
            console.error('Errore nel controllo disponibilità:', error);
            // Fallback to local check if API fails
            this.updateAvailabilityInfoLocal(weekday, timeSlot, availabilityInfo);
        }
    }

    /**
     * Controllo disponibilità locale come fallback
     */
    updateAvailabilityInfoLocal(weekday, timeSlot, availabilityInfo) {
        // Controlla se la fascia oraria è disponibile per il giorno
        if (!this.timeSlotAvailability[timeSlot].includes(weekday)) {
            availabilityInfo.className = 'availability-info unavailable';
            availabilityInfo.innerHTML = `
                <i class="fas fa-times-circle"></i>
                La fascia oraria "${this.getTimeSlotDisplayName(timeSlot)}" non è disponibile per ${this.getWeekdayDisplayName(weekday)}
            `;
            return;
        }

        // Conta prenotazioni esistenti per questa combinazione
        const existingBookings = this.bookings.filter(booking => 
            booking.weekday === weekday && booking.timeSlot === timeSlot
        ).length;

        const available = this.maxBookingsPerSlot - existingBookings;

        if (available <= 0) {
            availabilityInfo.className = 'availability-info full';
            availabilityInfo.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i>
                Fascia oraria completa! Non ci sono postazioni disponibili.
            `;
        } else if (available <= 2) {
            availabilityInfo.className = 'availability-info limited';
            availabilityInfo.innerHTML = `
                <i class="fas fa-info-circle"></i>
                Attenzione: Solo ${available} postazione/i rimaste per questa fascia oraria.
            `;
        } else {
            availabilityInfo.className = 'availability-info available';
            availabilityInfo.innerHTML = `
                <i class="fas fa-check-circle"></i>
                Postazioni disponibili: ${available} su ${this.maxBookingsPerSlot}
            `;
        }
    }

    /**
     * Gestisce l'invio del form
     */
    async handleFormSubmit(event) {
        event.preventDefault();
        
        const submitBtn = document.querySelector('.submit-btn');
        const originalText = submitBtn.innerHTML;
        
        // Disabilita il pulsante durante l'elaborazione
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Elaborazione...';

        try {
            const formData = new FormData(event.target);
            const bookingData = {
                name: formData.get('userName').trim(),
                weekday: formData.get('weekday'),
                timeSlot: formData.get('timeSlot')
            };

            // Validazione base
            if (!bookingData.name || bookingData.name.length < 2) {
                this.showNotification('Il nome deve contenere almeno 2 caratteri', 'error');
                return;
            }

            if (!bookingData.weekday || !bookingData.timeSlot) {
                this.showNotification('Seleziona giorno e fascia oraria', 'error');
                return;
            }

            // Salva prenotazione nel database
            const newBooking = await this.saveBooking(bookingData);
            
            // Ricarica prenotazioni dal database
            await this.loadBookings();
            
            // Reset form
            event.target.reset();
            
            // Messaggio di successo
            this.showNotification(
                `Prenotazione confermata per ${bookingData.name}! 
                ${this.getWeekdayDisplayName(bookingData.weekday)} - ${this.getTimeSlotDisplayName(bookingData.timeSlot)}`,
                'success'
            );

        } catch (error) {
            console.error('Errore durante la prenotazione:', error);
            this.showNotification(error.message || 'Si è verificato un errore durante la prenotazione. Riprova.', 'error');
        } finally {
            // Riabilita il pulsante
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }

    /**
     * Valida i dati di prenotazione
     */
    validateBooking(bookingData) {
        // Controllo nome
        if (!bookingData.name || bookingData.name.length < 2) {
            return {
                isValid: false,
                message: 'Il nome deve contenere almeno 2 caratteri'
            };
        }

        if (bookingData.name.length > 100) {
            return {
                isValid: false,
                message: 'Il nome non può superare i 100 caratteri'
            };
        }

        // Controllo giorno
        if (!bookingData.weekday) {
            return {
                isValid: false,
                message: 'Seleziona un giorno della settimana'
            };
        }

        // Controllo fascia oraria
        if (!bookingData.timeSlot) {
            return {
                isValid: false,
                message: 'Seleziona una fascia oraria'
            };
        }

        // Controllo disponibilità fascia oraria per il giorno
        if (!this.timeSlotAvailability[bookingData.timeSlot].includes(bookingData.weekday)) {
            return {
                isValid: false,
                message: `La fascia oraria "${this.getTimeSlotDisplayName(bookingData.timeSlot)}" non è disponibile per ${this.getWeekdayDisplayName(bookingData.weekday)}`
            };
        }

        // Controllo prenotazioni duplicate
        const duplicateBooking = this.bookings.find(booking => 
            booking.name.toLowerCase() === bookingData.name.toLowerCase() &&
            booking.weekday === bookingData.weekday &&
            booking.timeSlot === bookingData.timeSlot
        );

        if (duplicateBooking) {
            return {
                isValid: false,
                message: 'Hai già una prenotazione per questa fascia oraria'
            };
        }

        // Controllo numero massimo prenotazioni per slot
        const existingBookings = this.bookings.filter(booking => 
            booking.weekday === bookingData.weekday && 
            booking.timeSlot === bookingData.timeSlot
        ).length;

        if (existingBookings >= this.maxBookingsPerSlot) {
            return {
                isValid: false,
                message: 'Questa fascia oraria è al completo'
            };
        }

        return { isValid: true };
    }

    /**
     * Aggiorna la visualizzazione delle prenotazioni attive
     */
    updateActiveBookingsDisplay() {
        const container = document.getElementById('activeBookings');
        
        if (this.bookings.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>Nessuna prenotazione attiva</p>
                </div>
            `;
            return;
        }

        // Ordina prenotazioni per giorno e fascia oraria
        const sortedBookings = [...this.bookings].sort((a, b) => {
            const weekdayOrder = ['lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi'];
            const timeSlotOrder = ['mattina', 'pomeriggio'];
            
            const dayComparison = weekdayOrder.indexOf(a.weekday) - weekdayOrder.indexOf(b.weekday);
            if (dayComparison !== 0) return dayComparison;
            
            return timeSlotOrder.indexOf(a.timeSlot) - timeSlotOrder.indexOf(b.timeSlot);
        });

        container.innerHTML = sortedBookings.map(booking => `
            <div class="booking-item" data-booking-id="${booking.id}">
                <div class="booking-info">
                    <div class="booking-name">${this.escapeHtml(booking.name)}</div>
                    <div class="booking-details">
                        <i class="fas fa-calendar"></i>
                        ${this.getWeekdayDisplayName(booking.weekday)}
                        <i class="fas fa-clock"></i>
                        ${this.getTimeSlotDisplayName(booking.timeSlot)}
                    </div>
                </div>
                <button class="delete-btn" onclick="bookingSystem.deleteBooking('${booking.id}')" 
                        aria-label="Elimina prenotazione di ${this.escapeHtml(booking.name)}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
    }

    /**
     * Elimina una prenotazione
     */
    async deleteBooking(bookingId) {
        const booking = this.bookings.find(booking => booking.id == bookingId);
        
        if (!booking) {
            this.showNotification('Prenotazione non trovata', 'error');
            return;
        }
        
        // Conferma eliminazione
        if (!confirm(`Sei sicuro di voler eliminare la prenotazione di ${booking.name}?`)) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}?/api/bookings/${bookingId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Errore durante l\'eliminazione');
            }

            // Ricarica le prenotazioni dal database
            await this.loadBookings();
            
            this.showNotification('Prenotazione eliminata con successo', 'success');
        } catch (error) {
            console.error('Errore durante l\'eliminazione:', error);
            this.showNotification(error.message || 'Errore durante l\'eliminazione della prenotazione', 'error');
        }
    }

    /**
     * Mostra notifiche all'utente
     */
    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        
        notification.textContent = message;
        notification.className = `notification ${type}`;
        
        // Mostra notifica
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        // Nascondi notifica dopo 5 secondi
        setTimeout(() => {
            notification.classList.remove('show');
        }, 5000);
    }

    /**
     * Genera un ID univoco per la prenotazione
     */
    generateBookingId() {
        return `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Converte il valore del giorno nel nome visualizzato
     */
    getWeekdayDisplayName(weekday) {
        const names = {
            'lunedi': 'Lunedì',
            'martedi': 'Martedì',
            'mercoledi': 'Mercoledì',
            'giovedi': 'Giovedì',
            'venerdi': 'Venerdì'
        };
        return names[weekday] || weekday;
    }

    /**
     * Converte il valore della fascia oraria nel nome visualizzato
     */
    getTimeSlotDisplayName(timeSlot) {
        const names = {
            'mattina': 'Mattina (8:30–13:30)',
            'pomeriggio': 'Pomeriggio (14:00–17:00)'
        };
        return names[timeSlot] || timeSlot;
    }

    /**
     * Escape HTML per prevenire XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Pulisce tutte le prenotazioni (per debug/reset)
     */
    clearAllBookings() {
        if (confirm('Sei sicuro di voler eliminare tutte le prenotazioni?')) {
            this.bookings = [];
            this.saveBookings();
            this.updateActiveBookingsDisplay();
            this.updateAvailabilityInfo();
            this.showNotification('Tutte le prenotazioni sono state eliminate', 'success');
        }
    }

    /**
     * Esporta prenotazioni (utile per backup)
     */
    exportBookings() {
        const dataStr = JSON.stringify(this.bookings, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `prenotazioni_biblioteca_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        this.showNotification('Prenotazioni esportate con successo', 'success');
    }

    /**
     * Inizializza la tabella settimanale
     */
    initializeWeeklyTable() {
        this.updateWeeklyTable();
        // Controlla ogni ora se è necessario resettare la tabella
        setInterval(() => {
            this.checkAndResetWeeklyTable();
        }, 60 * 60 * 1000); // Ogni ora
    }

    /**
     * Controlla se è sabato e resetta la tabella se necessario
     */
    async checkAndResetWeeklyTable() {
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0 = domenica, 6 = sabato
        
        // Se è sabato e sono passate le 00:00
        if (dayOfWeek === 6 && now.getHours() === 0 && now.getMinutes() < 60) {
            try {
                // Cancella tutte le prenotazioni dal database
                const response = await fetch('/api/bookings/reset', {
                    method: 'POST'
                });
                
                if (response.ok) {
                    this.bookings = [];
                    this.updateActiveBookingsDisplay();
                    this.updateWeeklyTable();
                    this.showNotification('Tabella settimanale resettata automaticamente', 'success');
                }
            } catch (error) {
                console.error('Errore durante il reset settimanale:', error);
            }
        }
    }

    /**
     * Aggiorna la visualizzazione della tabella settimanale
     */
    updateWeeklyTable() {
        const container = document.getElementById('weeklyTable');
        
        const weekdays = ['lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi'];
        const timeSlots = ['mattina', 'pomeriggio'];
        
        // Crea la struttura della tabella
        let tableHTML = `
            <table class="weekly-table">
                <thead>
                    <tr>
                        <th>Fascia Oraria</th>
                        <th>Lunedì</th>
                        <th>Martedì</th>
                        <th>Mercoledì</th>
                        <th>Giovedì</th>
                        <th>Venerdì</th>
                    </tr>
                </thead>
                <tbody>
        `;

        timeSlots.forEach(timeSlot => {
            tableHTML += `<tr>`;
            tableHTML += `<td class="time-slot-cell">${this.getTimeSlotDisplayName(timeSlot)}</td>`;
            
            weekdays.forEach(weekday => {
                const isAvailable = this.timeSlotAvailability[timeSlot].includes(weekday);
                
                if (!isAvailable) {
                    tableHTML += `<td class="day-cell unavailable-cell">Non disponibile</td>`;
                } else {
                    const bookingsForSlot = this.bookings.filter(booking => 
                        booking.weekday === weekday && booking.timeSlot === timeSlot
                    );
                    
                    const count = bookingsForSlot.length;
                    const available = this.maxBookingsPerSlot - count;
                    
                    let countClass = 'booking-count';
                    if (count >= this.maxBookingsPerSlot) {
                        countClass += ' full';
                    } else if (available <= 2) {
                        countClass += ' limited';
                    }
                    
                    tableHTML += `<td class="day-cell">`;
                    tableHTML += `<div class="${countClass}">${count}/${this.maxBookingsPerSlot}</div>`;
                    
                    if (bookingsForSlot.length > 0) {
                        tableHTML += `<div class="booking-names">`;
                        bookingsForSlot.forEach(booking => {
                            tableHTML += `<div class="booking-name">${this.escapeHtml(booking.name)}</div>`;
                        });
                        tableHTML += `</div>`;
                    }
                    
                    tableHTML += `</td>`;
                }
            });
            
            tableHTML += `</tr>`;
        });

        tableHTML += `
                </tbody>
            </table>
        `;

        container.innerHTML = tableHTML;
    }
}

// Inizializza il sistema quando il DOM è caricato
let bookingSystem;

document.addEventListener('DOMContentLoaded', () => {
    bookingSystem = new LibraryBookingSystem();
    
    // Debug console commands (rimuovi in produzione)
    if (typeof window !== 'undefined') {
        window.debugBookings = {
            clear: () => bookingSystem.clearAllBookings(),
            export: () => bookingSystem.exportBookings(),
            show: () => console.table(bookingSystem.bookings)
        };
    }
});

// Service Worker per cache offline (opzionale)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}
