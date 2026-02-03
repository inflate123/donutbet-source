/**
 * Site-wide money: shortened display ($3.4k, $4m) and parse "5m" -> 5000000.
 * formatMoney(n) -> "3.4k", "4m" (no $; add in template).
 * parseMoney(str) -> number from "5m", "3.4k", "1.2b", "5000", etc.
 */
(function() {
    'use strict';

    function formatMoney(num) {
        if (num === null || num === undefined || isNaN(num)) return '0';
        num = Number(num);
        if (num >= 1e9) return (num / 1e9).toFixed(1).replace(/\.0$/, '') + 'b';
        if (num >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'm';
        if (num >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
        if (num === Math.floor(num)) return String(Math.floor(num));
        return num.toFixed(2).replace(/\.?0+$/, '');
    }

    function parseMoney(str) {
        if (str === null || str === undefined) return NaN;
        str = (str + '').trim().toLowerCase().replace(/\s/g, '').replace(/,/g, '').replace(/\$/g, '');
        var num = parseFloat(str);
        if (str.endsWith('k')) num = parseFloat(str.slice(0, -1)) * 1e3;
        else if (str.endsWith('m')) num = parseFloat(str.slice(0, -1)) * 1e6;
        else if (str.endsWith('b')) num = parseFloat(str.slice(0, -1)) * 1e9;
        return isNaN(num) ? NaN : num;
    }

    window.formatMoney = formatMoney;
    window.parseMoney = parseMoney;

    // Update header balance display
    function updateHeaderBalance(newBalance) {
        var el = document.getElementById('header-balance');
        if (el) {
            var oldBalance = parseFloat(el.getAttribute('data-money')) || 0;
            el.setAttribute('data-money', newBalance);
            el.textContent = formatMoney(newBalance);

            // Add visual feedback if balance changed
            if (Math.abs(newBalance - oldBalance) > 0.01) {
                el.classList.add('balance-updated');
                setTimeout(function() {
                    el.classList.remove('balance-updated');
                }, 600);
            }
        }
        // Also update wallet popup balance if visible
        var walletBalance = document.querySelector('.wallet-popup-balance [data-money]');
        if (walletBalance) {
            walletBalance.setAttribute('data-money', newBalance);
            walletBalance.textContent = formatMoney(newBalance);
        }
    }
    window.updateHeaderBalance = updateHeaderBalance;

    // Get current balance from header
    function getCurrentBalance() {
        var el = document.getElementById('header-balance');
        if (el) {
            var raw = parseFloat(el.getAttribute('data-money'));
            return isNaN(raw) ? 0 : raw;
        }
        return 0;
    }
    window.getCurrentBalance = getCurrentBalance;

    // Deduct amount from balance instantly (optimistic update)
    function deductBalance(amount) {
        var current = getCurrentBalance();
        var newBalance = Math.max(0, current - amount);
        updateHeaderBalance(newBalance);
        return newBalance;
    }
    window.deductBalance = deductBalance;

    // Add amount to balance instantly
    function addBalance(amount) {
        var current = getCurrentBalance();
        var newBalance = current + amount;
        updateHeaderBalance(newBalance);
        return newBalance;
    }
    window.addBalance = addBalance;

    // ============================================
    // Real-time Balance Polling System
    // Keeps balance in sync across all pages
    // ============================================
    var balancePollInterval = null;
    var BALANCE_POLL_INTERVAL = 3000; // Poll every 3 seconds

    // Fetch balance from server and update if changed
    function fetchAndUpdateBalance() {
        var el = document.getElementById('header-balance');
        if (!el) return; // Not logged in

        fetch('/api/balance')
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.success && typeof data.balance === 'number') {
                    var currentDisplayed = parseFloat(el.getAttribute('data-money')) || 0;
                    // Only update if different
                    if (Math.abs(data.balance - currentDisplayed) > 0.001) {
                        updateHeaderBalance(data.balance);
                    }
                }
            })
            .catch(function() {
                // Silent fail
            });
    }
    window.fetchAndUpdateBalance = fetchAndUpdateBalance;

    // Start balance polling
    function startBalancePolling() {
        if (balancePollInterval) return;
        var el = document.getElementById('header-balance');
        if (!el) return; // Not logged in

        // Initial fetch
        fetchAndUpdateBalance();

        // Poll periodically
        balancePollInterval = setInterval(function() {
            if (!document.hidden) {
                fetchAndUpdateBalance();
            }
        }, BALANCE_POLL_INTERVAL);
    }

    // Stop balance polling
    function stopBalancePolling() {
        if (balancePollInterval) {
            clearInterval(balancePollInterval);
            balancePollInterval = null;
        }
    }

    function formatMoneyElements() {
        document.querySelectorAll('[data-money]').forEach(function(el) {
            var raw = parseFloat(el.getAttribute('data-money'));
            if (!isNaN(raw)) el.textContent = formatMoney(raw);
        });
    }

    function initMoney() {
        formatMoneyElements();
        startBalancePolling();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMoney);
    } else {
        initMoney();
    }

    // Handle visibility change - pause/resume balance polling
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            stopBalancePolling();
        } else {
            startBalancePolling();
        }
    });

    // ============================================
    // Global Coinflip Notification System
    // Works across all pages to notify when someone joins your coinflip
    // ============================================

    var globalCoinflipPollInterval = null;
    var COINFLIP_STORAGE_KEY = 'pendingCoinflips';

    // Get pending coinflips from localStorage
    function getPendingCoinflips() {
        try {
            var data = localStorage.getItem(COINFLIP_STORAGE_KEY);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            return {};
        }
    }

    // Save pending coinflips to localStorage
    function savePendingCoinflips(data) {
        try {
            localStorage.setItem(COINFLIP_STORAGE_KEY, JSON.stringify(data));
        } catch (e) {}
    }

    // Register a new pending coinflip (called when user creates a coinflip)
    function registerPendingCoinflip(gameId) {
        var pending = getPendingCoinflips();
        pending[gameId] = { created: Date.now(), notified: false };
        savePendingCoinflips(pending);
    }
    window.registerPendingCoinflip = registerPendingCoinflip;

    // Mark a coinflip as notified
    function markCoinflipNotified(gameId) {
        var pending = getPendingCoinflips();
        if (pending[gameId]) {
            pending[gameId].notified = true;
            savePendingCoinflips(pending);
        }
    }
    window.markCoinflipNotified = markCoinflipNotified;

    // Remove old pending coinflips (older than 1 hour)
    function cleanupPendingCoinflips() {
        var pending = getPendingCoinflips();
        var now = Date.now();
        var changed = false;
        for (var id in pending) {
            if (now - pending[id].created > 3600000) { // 1 hour
                delete pending[id];
                changed = true;
            }
        }
        if (changed) savePendingCoinflips(pending);
    }

    // Show global coinflip notification
    function showCoinflipJoinNotification(game) {
        // Create notification element
        var notification = document.createElement('div');
        notification.className = 'global-cf-notification';
        notification.innerHTML =
            '<div class="global-cf-notification-content">' +
                '<div class="global-cf-notification-icon">' +
                    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                        '<circle cx="12" cy="12" r="10"></circle>' +
                        '<path d="M12 6v6l4 2"></path>' +
                    '</svg>' +
                '</div>' +
                '<div class="global-cf-notification-text">' +
                    '<strong>' + escapeHtmlGlobal(game.ice.username) + '</strong> joined your coinflip!' +
                    '<span class="global-cf-notification-amount">$' + formatMoney(game.amount * 2) + ' pot</span>' +
                '</div>' +
                '<button class="global-cf-notification-btn">View Result</button>' +
                '<button class="global-cf-notification-close">&times;</button>' +
            '</div>';

        document.body.appendChild(notification);

        // Play sound
        try {
            var sound = new Audio('audio/hat.ogg');
            sound.volume = 0.5;
            sound.play().catch(function() {});
        } catch (e) {}

        // Animate in
        setTimeout(function() {
            notification.classList.add('active');
        }, 10);

        // Click to view
        notification.querySelector('.global-cf-notification-btn').addEventListener('click', function() {
            window.location.href = '/coinflip?view=' + game.id;
        });

        // Close button
        notification.querySelector('.global-cf-notification-close').addEventListener('click', function() {
            notification.classList.remove('active');
            setTimeout(function() { notification.remove(); }, 300);
        });

        // Auto-hide after 10 seconds
        setTimeout(function() {
            if (notification.parentNode) {
                notification.classList.remove('active');
                setTimeout(function() { notification.remove(); }, 300);
            }
        }, 10000);
    }

    function escapeHtmlGlobal(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Check for joined coinflips globally
    function checkGlobalCoinflipJoins() {
        // Skip if on coinflip page (that page has its own handling)
        if (window.location.pathname === '/coinflip') return;

        // Skip if no user logged in
        if (!window.currentUserId) return;

        var pending = getPendingCoinflips();
        var gameIds = Object.keys(pending).filter(function(id) {
            return !pending[id].notified;
        });

        if (gameIds.length === 0) return;

        // Fetch coinflip list
        fetch('/coinflip/list')
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!data.coinflips) return;

                data.coinflips.forEach(function(game) {
                    var isMyGame = game.fire && game.fire.id === window.currentUserId;
                    var hasOpponent = !!game.ice;
                    var hasWinner = !!game.winnerSide;

                    if (isMyGame && hasOpponent && hasWinner && pending[game.id] && !pending[game.id].notified) {
                        markCoinflipNotified(game.id);
                        showCoinflipJoinNotification(game);
                    }
                });

                // Clean up games that are completed
                data.coinflips.forEach(function(game) {
                    if (game.winnerSide && pending[game.id]) {
                        // Game is done, can remove from pending after a delay
                        setTimeout(function() {
                            var p = getPendingCoinflips();
                            delete p[game.id];
                            savePendingCoinflips(p);
                        }, 60000); // Keep for 1 min after notification
                    }
                });
            })
            .catch(function() {});
    }

    // Start global coinflip polling
    function startGlobalCoinflipPolling() {
        if (globalCoinflipPollInterval) return;

        // Clean up old entries
        cleanupPendingCoinflips();

        // Poll every 3 seconds
        globalCoinflipPollInterval = setInterval(checkGlobalCoinflipJoins, 3000);

        // Also check immediately
        setTimeout(checkGlobalCoinflipJoins, 1000);
    }

    // Initialize global polling when page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startGlobalCoinflipPolling);
    } else {
        startGlobalCoinflipPolling();
    }

    // Pause when page is hidden
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            if (globalCoinflipPollInterval) {
                clearInterval(globalCoinflipPollInterval);
                globalCoinflipPollInterval = null;
            }
        } else {
            startGlobalCoinflipPolling();
        }
    });

})();
