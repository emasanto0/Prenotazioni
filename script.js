class LibraryBookingSystem {
    constructor() {
        this.bookings = [];
        this.maxBookingsPerSlot = 10; // numero massimo prenotazioni per fascia oraria
        this.timeSlotAvailability = {
            mattina: ['lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi'],
            pomeriggio: ['lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi']
        };

        this.loadBookings();
        this.initializeWeeklyTable();

        // Associa eventi
        document.getElementById('weekday').addEventListener('change', () => this.updateAvailabilityInfo());
        document.getElementById('timeSlot').addEventListener('change', () => this.updateAvailabilityInfo());
        document.getElementById('bookingForm').addEventListener('submit', (e) => this.handleFormSubmit(e));
    }

    /**
     * Carica prenotazioni da API o localStorage
     */
    async loadBookings() {
        try {
            const response = await fetch('/api/bookings');
            if (!response.ok) throw new Error('Errore caricamento prenotazioni');
            this.bookings = await response.json();
        } catch (error) {
            console.warn('Caricamento da API fallito, uso dati locali', error);
            // fallback: carica da localStorage o array vuoto
            const localData = localStorage.getItem('libraryBookings');
            this.bookings = localData ? JSON.parse(localData) : [];
        }
        this.updateActiveBookingsDisplay();
        this.updateAvailabilityInfo();
        this.updateWeeklyTable();
    }

    /**
     * Salva prenotazioni su localStorage (fallback)
     */
    saveBookings() {
        localStorage.setItem('libraryBookings', JSON.stringify(this.bookings));
    }

    /**
     * Salva una nuova prenotazione nel backend o localmente
     */
    async saveBooking(bookingData) {
        const validation = this.validateBooking(bookingData);
        if (!validation.isValid) {
            throw new Error(validation.message);
        }

        const newBooking = {
            id: this.generateBookingId(),
            name: bookingData.name,
            weekday: bookingData.weekday,
            timeSlot: bookingData.timeSlot
        };

        try {
            const response = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newBooking)
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Errore nel salvataggio prenotazione');
            }
            this.bookings.push(newBooking);
            this.saveBookings();
            this.updateActiveBookingsDisplay();
            this.updateAvailabilityInfo();
            this.updateWeeklyTable();
            return newBooking;
        } catch (error) {
            // fallback locale
            this.bookings.push(newBooking);
            this.saveBookings();
            this.updateActiveBookingsDisplay();
            this.updateAvailabilityInfo();
            this.updateWeeklyTable();
            return newBooking;
        }
    }

    /**
     * Aggiorna le informazioni di disponibilità per fascia oraria e giorno
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
            availabilityInfo.style.display = 'block';
        } catch (error) {
            console.error('Errore nel controllo disponibilità:', error);
            // Fallback to local check if API fails
            this.updateAvailabilityInfoLocal(weekday, timeSlot, availabilityInfo);
            availabilityInfo.style.display = 'block';
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
                    <div class="booking-name
