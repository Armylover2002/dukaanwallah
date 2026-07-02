import { useState, useEffect } from 'react';

/**
 * useKeyboardVisible
 *
 * Detects whether the on-screen (virtual) keyboard is currently visible on
 * mobile devices. Works across Android Chrome, iOS Safari (≥15.4 via
 * visualViewport), and older browsers via a resize-based heuristic.
 *
 * Returns `true` when the keyboard is open so that fixed bottom navbars /
 * footers can hide themselves (or adjust position) to avoid sitting on top
 * of the keyboard.
 *
 * Detection strategy (ordered by reliability):
 *  1. `visualViewport` resize  – most accurate, works on Android & iOS ≥15.4
 *  2. `focusin` / `focusout`   – fallback signal when viewport API unavailable
 *  3. `window.resize`          – final fallback for older browsers
 *
 * The threshold of 85 % guards against minor browser-chrome changes (e.g.
 * URL bar showing/hiding) being misidentified as keyboard open.
 */
const useKeyboardVisible = () => {
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

    useEffect(() => {
        let baseHeight = window.visualViewport
            ? window.visualViewport.height
            : window.innerHeight;

        const checkViewport = () => {
            const current = window.visualViewport
                ? window.visualViewport.height
                : window.innerHeight;
            
            // Dynamically update base height if the viewport gets larger (e.g., URL bar hides)
            if (current > baseHeight) {
                baseHeight = current;
            }

            // Keyboards typically take up at least 200px. Small changes (~50-100px) are usually URL bars.
            // If the height drops by more than 150px, we assume the keyboard is open.
            setIsKeyboardVisible(baseHeight - current > 150);
        };

        const handleOrientationChange = () => {
            // Give the browser time to update the layout, then reset baseHeight
            setTimeout(() => {
                baseHeight = window.visualViewport
                    ? window.visualViewport.height
                    : window.innerHeight;
                checkViewport();
            }, 300);
        };

        window.addEventListener('orientationchange', handleOrientationChange);

        // focusin / focusout give us an instant signal, useful on iOS where the
        // visualViewport fires slightly after the keyboard animation starts.
        const handleFocusIn = (e) => {
            const tag = e.target?.tagName?.toLowerCase();
            const type = e.target?.type?.toLowerCase() ?? '';
            const nonTextTypes = ['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'image', 'range', 'color'];
            if (
                (tag === 'input' && !nonTextTypes.includes(type)) ||
                tag === 'textarea' ||
                e.target?.isContentEditable
            ) {
                setIsKeyboardVisible(true);
            }
        };

        // After blur we re-check via viewport in case the keyboard animates out.
        const handleFocusOut = () => {
            // Short delay to let the keyboard finish closing before re-measuring.
            setTimeout(checkViewport, 200);
        };

        // Register viewport events (most reliable on modern browsers).
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', checkViewport);
        }
        window.addEventListener('resize', checkViewport);
        document.addEventListener('focusin', handleFocusIn);
        document.addEventListener('focusout', handleFocusOut);

        return () => {
            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', checkViewport);
            }
            window.removeEventListener('resize', checkViewport);
            window.removeEventListener('orientationchange', handleOrientationChange);
            document.removeEventListener('focusin', handleFocusIn);
            document.removeEventListener('focusout', handleFocusOut);
        };
    }, []);

    return isKeyboardVisible;
};

export default useKeyboardVisible;
