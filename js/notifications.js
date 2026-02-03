(function() {
    'use strict';
    var TOAST_DURATION_MS = 4500;

    function ensureContainer() {
        var id = 'donut-toast-container';
        var el = document.getElementById(id);
        if (!el) {
            el = document.createElement('div');
            el.id = id;
            el.className = 'donut-toast-container';
            el.setAttribute('aria-live', 'polite');
            document.body.appendChild(el);
        }
        return el;
    }

    window.showNotification = function(message, isError) {
        if (!message) return;
        var container = ensureContainer();
        var toast = document.createElement('div');
        toast.className = 'donut-toast donut-toast--' + (isError ? 'error' : 'success');
        toast.textContent = message;
        container.appendChild(toast);
        requestAnimationFrame(function() {
            toast.classList.add('donut-toast--visible');
        });
        setTimeout(function() {
            toast.classList.remove('donut-toast--visible');
            setTimeout(function() {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 300);
        }, TOAST_DURATION_MS);
    };
})();
