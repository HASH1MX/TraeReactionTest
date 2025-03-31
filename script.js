document.addEventListener('DOMContentLoaded', () => {
    const reactionBox = document.getElementById('reaction-box');
    const resultDisplay = document.getElementById('result');
    const startInstruction = document.querySelector('.start-instruction');
    const restartBtn = document.getElementById('restart-btn');
    
    // Stats elements
    const bestTimeEl = document.getElementById('best-time');
    const avgTimeEl = document.getElementById('avg-time');
    const lastTimeEl = document.getElementById('last-time');
    
    // Settings elements
    const soundToggle = document.getElementById('sound-toggle');
    const difficultySelect = document.getElementById('difficulty');
    
    let state = 'waiting'; // waiting, ready, testing, finished
    let startTime;
    let timeoutId;
    let reactionHistory = [];
    const maxHistoryItems = 10;
    let soundEnabled = true;
    let difficultyRanges = {
        easy: { min: 2000, max: 6000 },
        medium: { min: 1000, max: 4000 },
        hard: { min: 500, max: 2000 }
    };
    let currentDifficulty = 'medium';
    
    // For graph
    let graphData = [];
    const maxGraphItems = 10;
    let reactionGraph;
    
    // Create audio elements for sound effects
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Function to play sound effects
    const playSound = (frequency, type, duration) => {
        if (!soundEnabled) return;
        
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = type;
        oscillator.frequency.value = frequency;
        gainNode.gain.value = 0.3;
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start();
        
        // Fade out for smoother sound
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
        
        setTimeout(() => {
            oscillator.stop();
        }, duration * 1000);
    };
    
    // Create history display element
    const historyContainer = document.createElement('div');
    historyContainer.id = 'history-container';
    historyContainer.innerHTML = '<h2>History</h2><div id="history-list"></div>';
    document.querySelector('.left-panel').appendChild(historyContainer);
    const historyList = document.getElementById('history-list');
    
    // Function to generate a random delay based on difficulty
    const getRandomDelay = () => {
        const range = difficultyRanges[currentDifficulty];
        return Math.floor(Math.random() * (range.max - range.min)) + range.min;
    };
    
    // Initialize the graph
    const initGraph = () => {
        const ctx = document.getElementById('reaction-graph').getContext('2d');
        
        // Create gradient for graph
        const gradient = ctx.createLinearGradient(0, 0, 0, 200);
        gradient.addColorStop(0, 'rgba(76, 175, 80, 0.8)');
        gradient.addColorStop(1, 'rgba(76, 175, 80, 0.2)');
        
        reactionGraph = {
            ctx: ctx,
            width: ctx.canvas.width,
            height: ctx.canvas.height,
            draw: function() {
                if (graphData.length < 2) return;
                
                const ctx = this.ctx;
                const width = ctx.canvas.width;
                const height = ctx.canvas.height;
                
                // Clear canvas
                ctx.clearRect(0, 0, width, height);
                
                // Find min and max values for scaling
                const values = graphData.map(item => item.time);
                const minValue = Math.min(...values);
                const maxValue = Math.max(...values);
                const range = maxValue - minValue || 200; // Prevent division by zero
                
                // Draw grid lines
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.lineWidth = 1;
                
                // Horizontal grid lines
                for (let i = 0; i < 5; i++) {
                    const y = height * (i / 4);
                    ctx.beginPath();
                    ctx.moveTo(0, y);
                    ctx.lineTo(width, y);
                    ctx.stroke();
                }
                
                // Draw the graph line
                ctx.beginPath();
                ctx.strokeStyle = '#FFEB3B';
                ctx.lineWidth = 2;
                ctx.lineJoin = 'round';
                
                // Calculate points
                const pointSpacing = width / (graphData.length - 1);
                
                graphData.forEach((point, index) => {
                    // Normalize the value (0 to 1)
                    const normalizedValue = 1 - ((point.time - minValue) / range);
                    // Scale to canvas height (leaving margin at top and bottom)
                    const y = height * (0.1 + normalizedValue * 0.8);
                    const x = index * pointSpacing;
                    
                    if (index === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                });
                
                ctx.stroke();
                
                // Draw points
                graphData.forEach((point, index) => {
                    const normalizedValue = 1 - ((point.time - minValue) / range);
                    const y = height * (0.1 + normalizedValue * 0.8);
                    const x = index * pointSpacing;
                    
                    ctx.beginPath();
                    ctx.arc(x, y, 4, 0, Math.PI * 2);
                    ctx.fillStyle = '#FFEB3B';
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                });
            }
        };
        
        // Set canvas size to match container
        const resizeGraph = () => {
            const container = document.getElementById('graph-container');
            const canvas = document.getElementById('reaction-graph');
            canvas.width = container.clientWidth - 30; // Adjust for padding
            canvas.height = container.clientHeight - 30;
            reactionGraph.width = canvas.width;
            reactionGraph.height = canvas.height;
            reactionGraph.draw();
        };
        
        // Initial resize and add window resize listener
        resizeGraph();
        window.addEventListener('resize', resizeGraph);
    };
    
    // Initialize graph when DOM is loaded
    initGraph();
    
    // Function to update history display and stats
    const updateHistory = (time, isTooSoon = false) => {
        // Add to history array
        if (!isTooSoon) {
            const newEntry = {
                time: time,
                date: new Date()
            };
            
            reactionHistory.unshift(newEntry);
            
            // Add to graph data
            graphData.push(newEntry);
            if (graphData.length > maxGraphItems) {
                graphData.shift();
            }
            
            // Update graph
            reactionGraph.draw();
            
            // Keep only the last maxHistoryItems
            if (reactionHistory.length > maxHistoryItems) {
                reactionHistory.pop();
            }
            
            // Update stats
            updateStats();
        }
        
        // Update history display
        historyList.innerHTML = '';
        if (reactionHistory.length === 0) {
            historyList.innerHTML = '<p class="no-history">No attempts yet</p>';
        } else {
            reactionHistory.forEach((item, index) => {
                const historyItem = document.createElement('div');
                historyItem.className = 'history-item';
                
                // Add performance indicator based on reaction time
                let performanceClass = '';
                if (item.time < 200) performanceClass = 'amazing';
                else if (item.time < 300) performanceClass = 'great';
                else if (item.time < 400) performanceClass = 'good';
                else performanceClass = 'normal';
                
                historyItem.classList.add(performanceClass);
                
                // Format date to be more readable
                const formattedTime = item.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});
                const formattedDate = item.date.toLocaleDateString([], {month: 'short', day: 'numeric'});
                
                historyItem.innerHTML = `
                    <span class="history-number">#${index + 1}</span>
                    <span class="history-time">${item.time.toFixed(1)} ms</span>
                    <span class="history-date">${formattedTime} - ${formattedDate}</span>
                `;
                historyList.appendChild(historyItem);
            });
        }
    };
    
    // Function to update stats display
    const updateStats = () => {
        if (reactionHistory.length === 0) return;
        
        // Calculate stats
        const times = reactionHistory.map(item => item.time);
        const bestTime = Math.min(...times);
        const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
        const lastTime = reactionHistory[0].time;
        
        // Update display
        bestTimeEl.textContent = bestTime.toFixed(1) + ' ms';
        avgTimeEl.textContent = avgTime.toFixed(1) + ' ms';
        lastTimeEl.textContent = lastTime.toFixed(1) + ' ms';
    };
    
    // Initialize history display
    updateHistory(0, true);
    
    // Function to start the test
    const startTest = () => {
        if (state !== 'waiting') return;
        
        state = 'ready';
        reactionBox.className = 'ready';
        startInstruction.style.display = 'none';
        resultDisplay.textContent = 'Wait for green...';
        
        // Play ready sound
        playSound(330, 'sine', 0.3);
        
        // Set a random delay before turning the box green
        const delay = getRandomDelay();
        timeoutId = setTimeout(() => {
            if (state === 'ready') {
                state = 'testing';
                reactionBox.className = 'go';
                startTime = performance.now();
                
                // Play go sound
                playSound(660, 'sine', 0.3);
            }
        }, delay);
    };
    
    // Function to handle box clicks
    const handleBoxClick = () => {
        if (state === 'waiting') {
            startTest();
        } else if (state === 'ready') {
            // Clicked too soon
            clearTimeout(timeoutId);
            state = 'finished';
            reactionBox.className = 'too-soon';
            resultDisplay.textContent = 'Too soon! Click the box to try again.';
            restartBtn.style.display = 'inline-block';
            
            // Play error sound
            playSound(220, 'sawtooth', 0.5);
            
            // Update history (mark as too soon)
            updateHistory(0, true);
        } else if (state === 'testing') {
            // Calculate reaction time
            const endTime = performance.now();
            const reactionTime = endTime - startTime;
            state = 'finished';
            
            // Play success sound
            const pitch = 440 + Math.floor((300 - Math.min(reactionTime, 300)) / 300 * 440);
            playSound(pitch, 'sine', 0.5);
            
            // Add to history
            updateHistory(reactionTime);
            
            // Determine performance message
            let performanceMsg = '';
            if (reactionTime < 200) {
                performanceMsg = 'Amazing reflexes!';
            } else if (reactionTime < 300) {
                performanceMsg = 'Great job!';
            } else if (reactionTime < 400) {
                performanceMsg = 'Good reflexes!';
            } else {
                performanceMsg = 'Keep practicing!';
            }
            
            // Display result with performance message
            resultDisplay.innerHTML = `
                <div class="result-time">${reactionTime.toFixed(1)} ms</div>
                <div class="result-message">${performanceMsg}</div>
            `;
            restartBtn.style.display = 'inline-block';
        } else if (state === 'finished') {
            resetTest();
        }
    };
    
    // Function to reset the test
    const resetTest = () => {
        state = 'waiting';
        reactionBox.className = 'waiting';
        resultDisplay.textContent = '';
        startInstruction.style.display = 'block';
        restartBtn.style.display = 'none';
        
        // Play reset sound
        playSound(440, 'sine', 0.2);
    };
    
    // Event listeners
    reactionBox.addEventListener('click', handleBoxClick);
    document.addEventListener('click', (e) => {
        // Start the test when clicking anywhere (only in waiting state)
        if (state === 'waiting' && e.target !== reactionBox && e.target !== restartBtn) {
            startTest();
        }
    });
    
    restartBtn.addEventListener('click', resetTest);
    
    // Add keyboard support (spacebar)
    document.addEventListener('keydown', (e) => {
        // Use spacebar as an alternative to clicking
        if (e.code === 'Space' || e.key === ' ') {
            e.preventDefault(); // Prevent page scrolling
            
            if (state === 'waiting') {
                startTest();
            } else if (state === 'testing') {
                handleBoxClick();
            } else if (state === 'finished') {
                resetTest();
            }
        }
    });
    
    // Settings event listeners
    soundToggle.addEventListener('change', () => {
        soundEnabled = soundToggle.checked;
        // Play a test sound when enabled
        if (soundEnabled) {
            playSound(440, 'sine', 0.2);
        }
    });
    
    difficultySelect.addEventListener('change', () => {
        currentDifficulty = difficultySelect.value;
    });
    
    // Add instructions about keyboard support
    const keyboardInstruction = document.createElement('p');
    keyboardInstruction.className = 'keyboard-instruction';
    keyboardInstruction.textContent = 'Pro tip: You can also use the spacebar!';
    document.querySelector('.container').insertBefore(keyboardInstruction, reactionBox);
});