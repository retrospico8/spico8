////////////////
// RETROSOUND //
////////////////

(function () {
    var ORDERED_NOTES         = [['C0', 16.35], ['C#0', 17.32], ['Db0', 17.32], ['D0', 18.35], ['D#0', 19.45], ['Eb0', 19.45], ['E0', 20.60], ['F0', 21.83], ['F#0', 23.12], ['Gb0', 23.12], ['G0', 24.50], ['G#0', 25.96], ['Ab0', 25.96], ['A0', 27.50], ['A#0', 29.14], ['Bb0', 29.14], ['B0', 30.87], ['C1', 32.70], ['C#1', 34.65], ['Db1', 34.65], ['D1', 36.71], ['D#1', 38.89], ['Eb1', 38.89], ['E1', 41.20], ['F1', 43.65], ['F#1', 46.25], ['Gb1', 46.25], ['G1', 49.00], ['G#1', 51.91], ['Ab1', 51.91], ['A1', 55.00], ['A#1', 58.27], ['Bb1', 58.27], ['B1', 61.74], ['C2', 65.41], ['C#2', 69.30], ['Db2', 69.30], ['D2', 73.42], ['D#2', 77.78], ['Eb2', 77.78], ['E2', 82.41], ['F2', 87.31], ['F#2', 92.50], ['Gb2', 92.50], ['G2', 98.00], ['G#2', 103.83], ['Ab2', 103.83], ['A2', 110.00], ['A#2', 116.54], ['Bb2', 116.54], ['B2', 123.47], ['C3', 130.81], ['C#3', 138.59], ['Db3', 138.59], ['D3', 146.83], ['D#3', 155.56], ['Eb3', 155.56], ['E3', 164.81], ['F3', 174.61], ['F#3', 185.00], ['Gb3', 185.00], ['G3', 196.00], ['G#3', 207.65], ['Ab3', 207.65], ['A3', 220.00], ['A#3', 233.08], ['Bb3', 233.08], ['B3', 246.94], ['C4', 261.63], ['C#4', 277.18], ['Db4', 277.18], ['D4', 293.66], ['D#4', 311.13], ['Eb4', 311.13], ['E4', 329.63], ['F4', 349.23], ['F#4', 369.99], ['Gb4', 369.99], ['G4', 392.00], ['G#4', 415.30], ['Ab4', 415.30], ['A4', 440.00], ['A#4', 466.16], ['Bb4', 466.16], ['B4', 493.88], ['C5', 523.25], ['C#5', 554.37], ['Db5', 554.37], ['D5', 587.33], ['D#5', 622.25], ['Eb5', 622.25], ['E5', 659.26], ['F5', 698.46], ['F#5', 739.99], ['Gb5', 739.99], ['G5', 783.99], ['G#5', 830.61], ['Ab5', 830.61], ['A5', 880.00], ['A#5', 932.33], ['Bb5', 932.33], ['B5', 987.77], ['C6', 1046.50], ['C#6', 1108.73], ['Db6', 1108.73], ['D6', 1174.66], ['D#6', 1244.51], ['Eb6', 1244.51], ['E6', 1318.51], ['F6', 1396.91], ['F#6', 1479.98], ['Gb6', 1479.98], ['G6', 1567.98], ['G#6', 1661.22], ['Ab6', 1661.22], ['A6', 1760.00], ['A#6', 1864.66], ['Bb6', 1864.66], ['B6', 1975.53], ['C7', 2093.00], ['C#7', 2217.46], ['Db7', 2217.46], ['D7', 2349.32], ['D#7', 2489.02], ['Eb7', 2489.02], ['E7', 2637.02], ['F7', 2793.83], ['F#7', 2959.96], ['Gb7', 2959.96], ['G7', 3135.96], ['G#7', 3322.44], ['Ab7', 3322.44], ['A7', 3520.00], ['A#7', 3729.31], ['Bb7', 3729.31], ['B7', 3951.07], ['C8', 4186.0]]
    var NOTES                 = _.zipObject(ORDERED_NOTES);
    var ANTI_CLICK_ADJUSTMENT = 0.01;

    var MODULATIONS_STEPS     = 16;
    var MODULATION_DEPTH      = 64;
    var TREMOLO_MAX_FREQUENCY = 20;

    var VIBRATO_MAX_FREQUENCY    = 20;
    var VIBRATO_DEPTH_ADJUSTMENT = 500;

    var NOISE_BASE_FREQUENCY         = 5000;
    var NOISE_BASE_Q                 = -7000;
    var NOISE_PITCH_SHIFT_ADJUSTMENT = 40000;
    var NOISE_NOTE_ADJUSTMENT        = 50;

    var PITCH_SHIFT_ADJUSTMENT = 200;

    // normalize AudioContext across browsers
    window.AudioContext = window.AudioContext||window.webkitAudioContext;

    function RetroSound (canvas) {
        this.context     = new AudioContext();
        this.clock       = new WAAClock(this.context);
        this.instruments = [];
        this.output      = this.context.createGain();

        this.output.connect(this.context.destination);

        this.clock.start();
    }

    RetroSound.prototype = {
        addInstrument: function (instrument) {
            var amp = this.context.createGain();
            amp.connect(this.output);
            amp.gain.value = 0;

            var tremoloGain = this.context.createGain();
            tremoloGain.connect(amp.gain);
            tremoloGain.gain.value = instrument.tremolo.active ? instrument.tremolo.depth : 0;

            var tremoloOsc = this.context.createOscillator();
            tremoloOsc.type = 'sine';
            tremoloOsc.connect(tremoloGain);
            tremoloOsc.frequency.value = instrument.tremolo.frequency;
            tremoloOsc.start();

            var vibratoGain = this.context.createGain();
            vibratoGain.gain.value = instrument.vibrato.active ? instrument.vibrato.depth * VIBRATO_DEPTH_ADJUSTMENT: 0;

            var vibratoOsc = this.context.createOscillator();
            vibratoOsc.type = 'sine';
            vibratoOsc.connect(vibratoGain);
            vibratoOsc.frequency.value = instrument.vibrato.frequency;
            vibratoOsc.start();

            instrument.amp         = amp;
            instrument.tremoloOsc  = tremoloOsc;
            instrument.tremoloGain = tremoloGain;
            instrument.vibratoOsc  = vibratoOsc;
            instrument.vibratoGain = vibratoGain;
            instrument.playingNote = null;

            this.instruments.push(instrument);
        },

        addInstruments: function (instruments) {
            var self = this;

            _.each(instruments, function (i) { self.addInstrument(i); });
        },

        generateDefaultInstrument: function () {
            return {
                oscillatorType: RetroSound.OSC_TYPES.SINE,
                tuning:         0,
                finetuning:     0,
                finetuning:     0,
                volume:         _.map(_.range(MODULATIONS_STEPS), function () { return 0.5; }),
                pitch:          _.map(_.range(MODULATIONS_STEPS), function () { return 0.5; }),
                glide:         false,
                tremolo: {
                    active:    false,
                    depth:     (MODULATION_DEPTH / 2) * (1 / MODULATION_DEPTH),
                    frequency: TREMOLO_MAX_FREQUENCY / 2
                },
                vibrato: {
                    active:    false,
                    depth:     (MODULATION_DEPTH / 2) * (1 / MODULATION_DEPTH),
                    frequency: VIBRATO_MAX_FREQUENCY / 2
                },
                arpeggio: {
                    active:    false,
                    notes:     [0, 0, 0, 0],
                    speed:     3
                }
            };
        },

        playNote: function (noteData) {
            var instrumentId = noteData.instrumentId;
            var note         = noteData.note;
            var time         = noteData.time;
            var bpm          = noteData.bpm;
            var doneCallback = noteData.doneCallback;
            var arpeggio     = noteData.arpeggio;
            var startTime    = noteData.startTime !== undefined ? noteData.startTime / 1000: this.context.currentTime;

            var self = this;

            var currentNoteIndex = _.findIndex(ORDERED_NOTES, function (n) { return n[0] === note; });

            var timeInSeconds      = time / 1000;
            var instrument         = this.instruments[instrumentId];

            if (instrument.tuning !== 0) {
                note = ORDERED_NOTES[currentNoteIndex + instrument.tuning][0];
            }

            var initialPitchShift = ((-0.5 + instrument.pitch[0]) * PITCH_SHIFT_ADJUSTMENT);
            var noteFrequency     = NOTES[note] + instrument.finetuning + initialPitchShift;

            if (instrument.oscillatorType === 'noise') {
                initialPitchShift = ((-0.5 + instrument.pitch[0]) * NOISE_PITCH_SHIFT_ADJUSTMENT);
                noteFrequency = ((NOTES[note] * NOISE_NOTE_ADJUSTMENT) + initialPitchShift) + NOISE_BASE_FREQUENCY
            }

            var oscillator;
            instrument.playingNote = oscillator;

            if (instrument.oscillatorType !== 'noise') {
                oscillator                 = this.context.createOscillator();
                oscillator.type            = instrument.oscillatorType;
                oscillator.frequency.value = noteFrequency;
                oscillator.connect(this.instruments[instrumentId].amp);
            } else {
                var bufferSize  = 2 * this.context.sampleRate;
                var noiseBuffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
                var output      = noiseBuffer.getChannelData(0);

                var biquadFilter = this.context.createBiquadFilter();
                biquadFilter.type = 'lowpass';
                biquadFilter.connect(this.instruments[instrumentId].amp);

                _.times(bufferSize, function (i) { output[i] = Math.random() * 2 - 1; });

                oscillator           = this.context.createBufferSource();
                oscillator.buffer    = noiseBuffer;
                oscillator.loop      = true;
                oscillator.frequency = biquadFilter.frequency;
                oscillator.connect(biquadFilter);

                oscillator.frequency.value = noteFrequency;
                biquadFilter.Q.value       = NOISE_BASE_Q;
            }

            oscillator.start(startTime);

            var stopTime  = startTime + timeInSeconds;

            // initial volume ramp up
            instrument.amp.gain.setValueAtTime(0, startTime);
            instrument.amp.gain.linearRampToValueAtTime(instrument.volume[0], startTime + ANTI_CLICK_ADJUSTMENT);

            // toggle tremolo and setup
            instrument.tremoloOsc.frequency.value = instrument.tremolo.frequency
            instrument.tremoloGain.gain.setValueAtTime(0, startTime);
            instrument.tremoloGain.gain.linearRampToValueAtTime(instrument.tremolo.active ? instrument.tremolo.depth : 0, startTime + ANTI_CLICK_ADJUSTMENT);

            // setup vibrato
            if (instrument.vibrato.active && !instrument.arpeggio.active) {
                instrument.vibratoOsc.frequency.value = instrument.vibrato.frequency;

                instrument.vibratoGain.gain.setValueAtTime(0, startTime);
                instrument.vibratoGain.gain.linearRampToValueAtTime(instrument.vibrato.active ? instrument.vibrato.depth * VIBRATO_DEPTH_ADJUSTMENT: 0, startTime + ANTI_CLICK_ADJUSTMENT);

                instrument.vibratoGain.connect(oscillator.frequency);
            }

            if (instrument.arpeggio.active) {
                var arpeggioNoteTime = ((1000 / (bpm / 60)) * (1 / (Math.pow(2, instrument.arpeggio.speed)))) / 1000;
                var arpeggioSteps    = timeInSeconds / arpeggioNoteTime;
                var arpeggioNotes    = _.flatten(_.times(Math.ceil(arpeggioSteps / instrument.arpeggio.notes.length), function () { return instrument.arpeggio.notes; }));

                _.each(arpeggioNotes, function (n, i) {
                    var arpeggioNoteFrequency = NOTES[ORDERED_NOTES[currentNoteIndex + instrument.tuning + n][0]] + instrument.finetuning;

                    if (!instrument.glide) {
                        oscillator.frequency.setValueAtTime(arpeggioNoteFrequency, startTime + (arpeggioNoteTime * i));
                    }
                    else {
                        oscillator.frequency.linearRampToValueAtTime(arpeggioNoteFrequency, startTime + (arpeggioNoteTime * i));
                    }
                });
            }

            // apply volume and pitch modulations
            var ticks = timeInSeconds / MODULATIONS_STEPS;
            _.times(MODULATIONS_STEPS, function (i) {
                if (i === 0) return;

                var volume          = instrument.volume[i];
                // ignore the first volume slide as it's already set
                instrument.amp.gain.linearRampToValueAtTime(volume, startTime + (ticks * i) + ANTI_CLICK_ADJUSTMENT);

                // ignore the pitch changes if arpeggio is active
                if (!instrument.arpeggio.active) {
                    var pitch           = instrument.pitch[i];
                    var pitchShift      = (-0.5 + pitch) * (instrument.oscillatorType === 'noise' ? NOISE_PITCH_SHIFT_ADJUSTMENT : PITCH_SHIFT_ADJUSTMENT);
                    var targetFrequency = (noteFrequency - initialPitchShift) + pitchShift

                    // ignore the first pitch slide as it's already set or if pitch modulation is enabled
                    if (!instrument.vibrato.active) {
                        oscillator.frequency.linearRampToValueAtTime(targetFrequency, startTime + (ticks * i) + ANTI_CLICK_ADJUSTMENT);
                    }
                }
            });

            // stop the oscillator
            self.clock.callbackAtTime(function () {
                var currentTime = self.context.currentTime;

                // gradually stop the note
                instrument.amp.gain.setValueAtTime(_.last(self.instruments[instrumentId].volume), currentTime);
                instrument.amp.gain.linearRampToValueAtTime(0.0, currentTime + ANTI_CLICK_ADJUSTMENT);

                // gradually stop the tremolo
                instrument.tremoloGain.gain.setValueAtTime(instrument.tremoloGain.gain.value, currentTime);
                instrument.tremoloGain.gain.linearRampToValueAtTime(0.0, currentTime + ANTI_CLICK_ADJUSTMENT);

                oscillator.stop(currentTime + (ANTI_CLICK_ADJUSTMENT * 2));
                instrument.vibratoGain.disconnect();

                instrument.playingNote = null;

                if (doneCallback !== undefined) doneCallback();
            }, stopTime - ANTI_CLICK_ADJUSTMENT)
        }

    };

    RetroSound.OSC_TYPES = {
        SINE:     'sine',
        SQUARE:   'square',
        SAWTOOTH: 'sawtooth',
        TRIANGLE: 'triangle',
        NOISE:    'noise'
    };
    RetroSound.ORDERED_NOTES         = ORDERED_NOTES;
    RetroSound.NOTES                 = NOTES;
    RetroSound.MODULATIONS_STEPS     = MODULATIONS_STEPS;
    RetroSound.MODULATION_DEPTH      = MODULATION_DEPTH;
    RetroSound.TREMOLO_MAX_FREQUENCY = TREMOLO_MAX_FREQUENCY;
    RetroSound.VIBRATO_MAX_FREQUENCY = VIBRATO_MAX_FREQUENCY;

    this.RetroSound = RetroSound;
})(this);
