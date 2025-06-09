/**
 * Sistema di prenotazione postazioni biblioteca
 * Gestisce prenotazioni con localStorage e validazione real-time
 */

class LibraryBookingSystem {
    constructor() {
        this.bookings = this.loadBookings();
        this.maxBookingsPerSlot = 4;
        this.timeSlotAvailability = {
            mattina: ['lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi'],
            pomeriggio: ['lunedi', 'martedi', 'mercoledi']
        };
        
        this.initializeEventListeners();
        this.updateActiveBookingsDisplay();
        this.updateAvailabilityInfo();
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
     * Carica le prenotazioni dal localStorage
     */
    loadBookings() {
        try {
            const stored = localStorage.getItem('libraryBookings');
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Errore nel caricamento delle prenotazioni:', error);
            return [];
        }
    }

    /**
     * Salva le prenotazioni nel localStorage
     */
    saveBookings() {
        try {
            localStorage.setItem('libraryBookings', JSON.stringify(this.bookings));
        } catch (error) {
            console.error('Errore nel salvataggio delle prenotazioni:', error);
            this.showNotification('Errore nel salvataggio della prenotazione', 'error');
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
    updateAvailabilityInfo() {
        const weekday = document.getElementById('weekday').value;
        const timeSlot = document.getElementById('timeSlot').value;
        const availabilityInfo = document.getElementById('availabilityInfo');

        if (!weekday || !timeSlot) {
            availabilityInfo.style.display = 'none';
            return;
        }

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
                timeSlot: formData.get('timeSlot'),
                timestamp: new Date().toISOString(),
                id: this.generateBookingId()
            };

            // Validazione
            const validation = this.validateBooking(bookingData);
            if (!validation.isValid) {
                this.showNotification(validation.message, 'error');
                return;
            }

            // Aggiungi prenotazione
            this.bookings.push(bookingData);
            this.saveBookings();
            
            // Aggiorna interfaccia
            this.updateActiveBookingsDisplay();
            this.updateAvailabilityInfo();
            
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
            this.showNotification('Si è verificato un errore durante la prenotazione. Riprova.', 'error');
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
    deleteBooking(bookingId) {
        const bookingIndex = this.bookings.findIndex(booking => booking.id === bookingId);
        
        if (bookingIndex === -1) {
            this.showNotification('Prenotazione non trovata', 'error');
            return;
        }

        const booking = this.bookings[bookingIndex];
        
        // Conferma eliminazione
        if (confirm(`Sei sicuro di voler eliminare la prenotazione di ${booking.name}?`)) {
            this.bookings.splice(bookingIndex, 1);
            this.saveBookings();
            this.updateActiveBookingsDisplay();
            this.updateAvailabilityInfo();
            
            this.showNotification('Prenotazione eliminata con successo', 'success');
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
